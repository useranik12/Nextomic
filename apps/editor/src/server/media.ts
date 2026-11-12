import { createHash, randomBytes } from "node:crypto";
import {
  actionBlocks,
  actionFlows,
  getDb,
  mediaAssets,
  mediaFolders,
  pages,
  projects,
  templates
} from "@nextomic/db";
import {
  MEDIA_ID,
  MEDIA_LARGE_BYTES,
  MEDIA_MAX_BYTES,
  MEDIA_NEEDS_ALT,
  MEDIA_PAGE_SIZE,
  MEDIA_SEGMENT,
  imageSize,
  mediaEditSchema,
  mediaFileName,
  mediaFolderNameSchema,
  mediaPath,
  mediaQuerySchema,
  mediaTagsSchema,
  formatBytes,
  refuseReason,
  sanitizeSvg,
  sniffMedia,
  SvgError,
  type MediaAsset,
  type MediaCounts,
  type MediaEdit,
  type MediaFolder,
  type MediaQuery,
  type MediaUsage
} from "@nextomic/schema";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { getStorageAdapter } from "@/lib/storage";
import { createRateLimiter } from "./rate-limit";

// Media library persistence. Callers MUST have passed authorizeProject for the project; every query
// is also scoped by projectId, so an id from another project never matches. Bytes live in storage
// under `media/<projectId>/<assetId>` (one fixed key per asset, so Replace file leaves nothing
// behind) and are served by app/media/[projectId]/[assetId]/[file].

export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

const WRITES = createRateLimiter(240, 60_000);
const UPLOADS = createRateLimiter(60, 60_000);

/** Counts one write for the user; throws once the minute's allowance is used. */
export function takeMediaWrite(userId: string, kind: "write" | "upload" = "write"): void {
  const r = (kind === "upload" ? UPLOADS : WRITES).take(`${kind}:${userId}`);
  if (!r.ok) throw new MediaError("Too many requests. Wait a moment and try again.");
}

const storageKey = (projectId: string, id: string) => `media/${projectId}/${id}`;

type Row = typeof mediaAssets.$inferSelect;

function toAsset(row: Row): MediaAsset {
  return {
    id: row.id,
    folderId: row.folderId,
    title: row.title,
    originalName: row.originalName,
    fileName: row.fileName,
    kind: row.kind,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
    tags: row.tags,
    path: mediaPath(row.projectId, row.id, row.fileName),
    hash: row.hash,
    replacedAt: row.replacedAt?.toISOString() ?? null,
    trashedAt: row.trashedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function assertProjectId(projectId: string) {
  if (!MEDIA_SEGMENT.test(projectId)) throw new MediaError("Invalid project.");
}

function assertIds(ids: readonly string[]): string[] {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new MediaError("Choose at least one file.");
  if (unique.length > 200) throw new MediaError("Choose up to 200 files at a time.");
  if (!unique.every((id) => MEDIA_ID.test(id))) throw new MediaError("Invalid file.");
  return unique;
}

async function assertFolder(projectId: string, folderId: string | null | undefined) {
  if (!folderId) return;
  const [row] = await getDb()
    .select({ id: mediaFolders.id })
    .from(mediaFolders)
    .where(and(eq(mediaFolders.id, folderId), eq(mediaFolders.projectId, projectId)))
    .limit(1);
  if (!row) throw new MediaError("That folder no longer exists.");
}

// ---------------------------------------------------------------- reading

function filterConditions(projectId: string, q: MediaQuery): SQL[] {
  const where: SQL[] = [eq(mediaAssets.projectId, projectId)];
  where.push(
    q.filter === "trash" ? isNotNull(mediaAssets.trashedAt) : isNull(mediaAssets.trashedAt)
  );
  if (q.folderId) where.push(eq(mediaAssets.folderId, q.folderId));
  switch (q.filter) {
    case "missing-alt":
      where.push(inArray(mediaAssets.kind, [...MEDIA_NEEDS_ALT]), eq(mediaAssets.alt, ""));
      break;
    case "missing-title":
      where.push(eq(mediaAssets.title, ""));
      break;
    case "untagged":
      where.push(sql`jsonb_array_length(${mediaAssets.tags}) = 0`);
      break;
    case "large":
      where.push(sql`${mediaAssets.size} > ${MEDIA_LARGE_BYTES}`);
      break;
    case "replaced":
      where.push(isNotNull(mediaAssets.replacedAt));
      break;
  }
  if (q.kinds && q.kinds.length > 0) where.push(inArray(mediaAssets.kind, q.kinds));
  if (q.type === "image") where.push(eq(mediaAssets.kind, "image"));
  else if (q.type === "svg") where.push(eq(mediaAssets.kind, "svg"));
  else if (q.type === "video") where.push(eq(mediaAssets.kind, "video"));
  else if (q.type === "other") where.push(inArray(mediaAssets.kind, ["audio", "other"]));
  if (q.search) {
    const like = `%${escapeLike(q.search.toLowerCase())}%`;
    where.push(
      or(
        sql`lower(${mediaAssets.title}) like ${like}`,
        sql`lower(${mediaAssets.originalName}) like ${like}`,
        sql`lower(${mediaAssets.alt}) like ${like}`,
        sql`lower(${mediaAssets.tags}::text) like ${like}`
      )!
    );
  }
  return where;
}

export async function listMedia(
  projectId: string,
  input: unknown
): Promise<{ assets: MediaAsset[]; total: number }> {
  assertProjectId(projectId);
  const q = mediaQuerySchema.parse(input);
  const where = and(...filterConditions(projectId, q));
  const order =
    q.sort === "oldest"
      ? asc(mediaAssets.createdAt)
      : q.sort === "name"
        ? asc(sql`lower(coalesce(nullif(${mediaAssets.title}, ''), ${mediaAssets.originalName}))`)
        : q.sort === "size"
          ? desc(mediaAssets.size)
          : desc(mediaAssets.createdAt);
  const db = getDb();
  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(mediaAssets)
      .where(where)
      .orderBy(order, asc(mediaAssets.id))
      .limit(MEDIA_PAGE_SIZE)
      .offset(q.offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(mediaAssets)
      .where(where)
  ]);
  return { assets: rows.map(toAsset), total: count?.n ?? 0 };
}

export async function mediaCounts(projectId: string): Promise<MediaCounts> {
  assertProjectId(projectId);
  const db = getDb();
  const live = isNull(mediaAssets.trashedAt);
  const [[row], folders] = await Promise.all([
    db
      .select({
        all: sql<number>`count(*) filter (where ${live})::int`,
        missingAlt: sql<number>`count(*) filter (where ${live} and ${mediaAssets.kind} in ('image','svg') and ${mediaAssets.alt} = '')::int`,
        missingTitle: sql<number>`count(*) filter (where ${live} and ${mediaAssets.title} = '')::int`,
        untagged: sql<number>`count(*) filter (where ${live} and jsonb_array_length(${mediaAssets.tags}) = 0)::int`,
        large: sql<number>`count(*) filter (where ${live} and ${mediaAssets.size} > ${MEDIA_LARGE_BYTES})::int`,
        replaced: sql<number>`count(*) filter (where ${live} and ${mediaAssets.replacedAt} is not null)::int`,
        trash: sql<number>`count(*) filter (where ${mediaAssets.trashedAt} is not null)::int`
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.projectId, projectId)),
    db
      .select({ id: mediaAssets.folderId, n: sql<number>`count(*)::int` })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.projectId, projectId), live, isNotNull(mediaAssets.folderId)))
      .groupBy(mediaAssets.folderId)
  ]);
  const byFolder: Record<string, number> = {};
  for (const f of folders) if (f.id) byFolder[f.id] = f.n;
  return {
    all: row?.all ?? 0,
    missingAlt: row?.missingAlt ?? 0,
    missingTitle: row?.missingTitle ?? 0,
    untagged: row?.untagged ?? 0,
    large: row?.large ?? 0,
    replaced: row?.replaced ?? 0,
    trash: row?.trash ?? 0,
    byFolder
  };
}

export async function getMedia(projectId: string, id: string): Promise<MediaAsset | null> {
  if (!MEDIA_SEGMENT.test(projectId) || !MEDIA_ID.test(id)) return null;
  const [row] = await getDb()
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)))
    .limit(1);
  return row ? toAsset(row) : null;
}

/** Bytes and headers data for the public route; null when the asset or its bytes are gone. */
export async function readMediaFile(
  projectId: string,
  id: string
): Promise<{ asset: MediaAsset; data: Uint8Array } | null> {
  const asset = await getMedia(projectId, id);
  if (!asset) return null;
  const data = await getStorageAdapter().get(storageKey(projectId, id));
  return data ? { asset, data } : null;
}

// ---------------------------------------------------------------- folders

export async function listFolders(projectId: string): Promise<MediaFolder[]> {
  assertProjectId(projectId);
  const rows = await getDb()
    .select({ id: mediaFolders.id, name: mediaFolders.name })
    .from(mediaFolders)
    .where(eq(mediaFolders.projectId, projectId))
    .orderBy(asc(sql`lower(${mediaFolders.name})`));
  return rows;
}

export async function createFolder(projectId: string, name: unknown): Promise<MediaFolder> {
  assertProjectId(projectId);
  const clean = mediaFolderNameSchema.parse(name);
  const [row] = await getDb()
    .insert(mediaFolders)
    .values({ projectId, name: clean })
    .onConflictDoNothing()
    .returning({ id: mediaFolders.id, name: mediaFolders.name });
  if (!row) throw new MediaError("A folder with that name already exists.");
  return row;
}

export async function renameFolder(
  projectId: string,
  id: string,
  name: unknown
): Promise<MediaFolder> {
  assertProjectId(projectId);
  const clean = mediaFolderNameSchema.parse(name);
  const clash = await getDb()
    .select({ id: mediaFolders.id })
    .from(mediaFolders)
    .where(and(eq(mediaFolders.projectId, projectId), eq(mediaFolders.name, clean)))
    .limit(1);
  if (clash[0] && clash[0].id !== id)
    throw new MediaError("A folder with that name already exists.");
  const [row] = await getDb()
    .update(mediaFolders)
    .set({ name: clean })
    .where(and(eq(mediaFolders.id, id), eq(mediaFolders.projectId, projectId)))
    .returning({ id: mediaFolders.id, name: mediaFolders.name });
  if (!row) throw new MediaError("That folder no longer exists.");
  return row;
}

/** Deletes the folder; its files move back to the library root. */
export async function deleteFolder(projectId: string, id: string): Promise<void> {
  assertProjectId(projectId);
  await getDb()
    .delete(mediaFolders)
    .where(and(eq(mediaFolders.id, id), eq(mediaFolders.projectId, projectId)));
}

// ---------------------------------------------------------------- writing

/** The bytes the library stores for an upload: validated from their own content, SVG cleaned. */
export function prepareUpload(
  name: string,
  input: Uint8Array
): { data: Uint8Array; format: NonNullable<ReturnType<typeof sniffMedia>>; fileName: string } {
  if (input.length === 0) throw new MediaError("This file is empty.");
  const format = sniffMedia(input);
  if (!format) throw new MediaError(refuseReason(input));
  let data = input;
  if (format.kind === "svg") {
    try {
      data = new TextEncoder().encode(sanitizeSvg(new TextDecoder().decode(input)));
    } catch (error) {
      throw new MediaError(error instanceof SvgError ? error.message : "This SVG cannot be read.");
    }
  }
  const cap = MEDIA_MAX_BYTES[format.kind];
  if (data.length > cap)
    throw new MediaError(
      `This file is ${formatBytes(data.length)}. The limit for this type is ${formatBytes(cap)}.`
    );
  return { data, format, fileName: mediaFileName(name, format.ext) };
}

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

export async function storeMedia(
  projectId: string,
  userId: string,
  file: { name: string; data: Uint8Array; folderId?: string | null }
): Promise<MediaAsset> {
  assertProjectId(projectId);
  await assertFolder(projectId, file.folderId);
  const { data, format, fileName } = prepareUpload(file.name, file.data);
  const dims = format.kind === "image" ? imageSize(data) : null;
  const id = randomBytes(12).toString("hex");
  await getStorageAdapter().put({ key: storageKey(projectId, id), data, contentType: format.mime });
  try {
    const [row] = await getDb()
      .insert(mediaAssets)
      .values({
        id,
        projectId,
        folderId: file.folderId ?? null,
        originalName: file.name.replace(/[\r\n\t]+/g, " ").slice(0, 200) || fileName,
        fileName,
        kind: format.kind,
        mime: format.mime,
        size: data.length,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        hash: sha256(data),
        createdBy: userId
      })
      .returning();
    return toAsset(row!);
  } catch (error) {
    await getStorageAdapter()
      .delete(storageKey(projectId, id))
      .catch(() => undefined);
    throw error;
  }
}

/** Swaps the bytes of an asset; its path, name, alt text and usages stay. Same kind only. */
export async function replaceMedia(
  projectId: string,
  id: string,
  file: { name: string; data: Uint8Array }
): Promise<MediaAsset> {
  const current = await getMedia(projectId, id);
  if (!current) throw new MediaError("That file no longer exists.");
  const { data, format } = prepareUpload(file.name, file.data);
  if (format.kind !== current.kind)
    throw new MediaError(
      `Replace it with another ${current.kind === "svg" ? "SVG" : current.kind} file.`
    );
  const dims = format.kind === "image" ? imageSize(data) : null;
  await getStorageAdapter().put({ key: storageKey(projectId, id), data, contentType: format.mime });
  const [row] = await getDb()
    .update(mediaAssets)
    .set({
      mime: format.mime,
      size: data.length,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      hash: sha256(data),
      replacedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)))
    .returning();
  return toAsset(row!);
}

export async function editMedia(
  projectId: string,
  id: string,
  input: unknown
): Promise<MediaAsset> {
  assertProjectId(projectId);
  if (!MEDIA_ID.test(id)) throw new MediaError("Invalid file.");
  const edit: MediaEdit = mediaEditSchema.parse(input);
  await assertFolder(projectId, edit.folderId);
  const [row] = await getDb()
    .update(mediaAssets)
    .set({ ...edit, updatedAt: new Date() })
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)))
    .returning();
  if (!row) throw new MediaError("That file no longer exists.");
  return toAsset(row);
}

/** Moves files to a folder (null = library root) and adds tags in one go. */
export async function bulkEditMedia(
  projectId: string,
  ids: readonly string[],
  input: { folderId?: string | null; addTags?: unknown }
): Promise<number> {
  assertProjectId(projectId);
  const list = assertIds(ids);
  const set: Partial<typeof mediaAssets.$inferInsert> = { updatedAt: new Date() };
  if (input.folderId !== undefined) {
    await assertFolder(projectId, input.folderId);
    set.folderId = input.folderId;
  }
  const db = getDb();
  const scope = and(eq(mediaAssets.projectId, projectId), inArray(mediaAssets.id, list));
  if (input.addTags !== undefined) {
    const add = mediaTagsSchema.parse(input.addTags);
    const rows = await db.select().from(mediaAssets).where(scope);
    for (const r of rows) {
      const tags = mediaTagsSchema.parse([...r.tags, ...add]);
      await db
        .update(mediaAssets)
        .set({ ...set, tags })
        .where(and(eq(mediaAssets.id, r.id), eq(mediaAssets.projectId, projectId)));
    }
    return rows.length;
  }
  const done = await db.update(mediaAssets).set(set).where(scope).returning({ id: mediaAssets.id });
  return done.length;
}

export async function trashMedia(projectId: string, ids: readonly string[]): Promise<number> {
  assertProjectId(projectId);
  const done = await getDb()
    .update(mediaAssets)
    .set({ trashedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(mediaAssets.projectId, projectId), inArray(mediaAssets.id, assertIds(ids))))
    .returning({ id: mediaAssets.id });
  return done.length;
}

export async function restoreMedia(projectId: string, ids: readonly string[]): Promise<number> {
  assertProjectId(projectId);
  const done = await getDb()
    .update(mediaAssets)
    .set({ trashedAt: null, updatedAt: new Date() })
    .where(and(eq(mediaAssets.projectId, projectId), inArray(mediaAssets.id, assertIds(ids))))
    .returning({ id: mediaAssets.id });
  return done.length;
}

async function purgeWhere(projectId: string, where: SQL | undefined): Promise<number> {
  const rows = await getDb()
    .delete(mediaAssets)
    .where(and(eq(mediaAssets.projectId, projectId), where))
    .returning({ id: mediaAssets.id });
  await Promise.all(
    rows.map((r) =>
      getStorageAdapter()
        .delete(storageKey(projectId, r.id))
        .catch(() => undefined)
    )
  );
  return rows.length;
}

/** Deletes trashed files for good (storage bytes included). Only trashed files can be purged. */
export function purgeMedia(projectId: string, ids: readonly string[]): Promise<number> {
  assertProjectId(projectId);
  return purgeWhere(
    projectId,
    and(inArray(mediaAssets.id, assertIds(ids)), isNotNull(mediaAssets.trashedAt))
  );
}

export function emptyMediaTrash(projectId: string): Promise<number> {
  assertProjectId(projectId);
  return purgeWhere(projectId, isNotNull(mediaAssets.trashedAt));
}

/** Removes every stored byte of a project's media; call before deleting the project. */
export async function deleteProjectMediaFiles(projectId: string): Promise<void> {
  assertProjectId(projectId);
  const rows = await getDb()
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(eq(mediaAssets.projectId, projectId));
  await Promise.all(
    rows.map((r) =>
      getStorageAdapter()
        .delete(storageKey(projectId, r.id))
        .catch(() => undefined)
    )
  );
}

// ---------------------------------------------------------------- usage

/**
 * Where an asset is used: pages, templates, project settings (classes, CSS files, app assets),
 * action flows and blocks. The asset id is part of every stored media path, so a text search over
 * the JSON finds element props, style values, backgrounds and action parameters alike.
 */
export async function mediaUsage(projectId: string, id: string): Promise<MediaUsage[]> {
  assertProjectId(projectId);
  if (!MEDIA_ID.test(id)) throw new MediaError("Invalid file.");
  const like = `%/${id}/%`;
  const db = getDb();
  const [pageRows, templateRows, settingsRows, flowRows, blockRows] = await Promise.all([
    db
      .select({ id: pages.id, name: pages.name })
      .from(pages)
      .where(
        and(
          eq(pages.projectId, projectId),
          or(
            sql`${pages.tree}::text like ${like}`,
            sql`${pages.settings}::text like ${like}`,
            sql`${pages.publishedSnapshot}::text like ${like}`
          )
        )
      ),
    db
      .select({ id: templates.id, name: templates.name })
      .from(templates)
      .where(
        and(
          eq(templates.projectId, projectId),
          or(
            sql`${templates.tree}::text like ${like}`,
            sql`${templates.settings}::text like ${like}`,
            sql`${templates.publishedSnapshot}::text like ${like}`
          )
        )
      ),
    db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          or(
            sql`${projects.settings}::text like ${like}`,
            sql`${projects.publishedSettings}::text like ${like}`
          )
        )
      ),
    db
      .select({ id: actionFlows.id, nodeId: actionFlows.nodeId })
      .from(actionFlows)
      .where(
        and(eq(actionFlows.projectId, projectId), sql`${actionFlows.flows}::text like ${like}`)
      ),
    db
      .select({ id: actionBlocks.id })
      .from(actionBlocks)
      .where(
        and(eq(actionBlocks.projectId, projectId), sql`${actionBlocks.block}::text like ${like}`)
      )
  ]);
  return [
    ...pageRows.map((r): MediaUsage => ({ kind: "page", id: r.id, name: r.name })),
    ...templateRows.map((r): MediaUsage => ({ kind: "template", id: r.id, name: r.name })),
    ...settingsRows.map(
      (): MediaUsage => ({ kind: "settings", id: projectId, name: "Design system and settings" })
    ),
    ...flowRows.map((r): MediaUsage => ({ kind: "action", id: r.id, name: "Action flow" })),
    ...blockRows.map((r): MediaUsage => ({ kind: "action", id: r.id, name: "Action block" }))
  ];
}

/** Asset ids (of the given ones) that are used somewhere; for the trash warning on a selection. */
export async function mediaInUse(projectId: string, ids: readonly string[]): Promise<string[]> {
  const list = assertIds(ids);
  const used = await Promise.all(
    list.map(async (id) => ((await mediaUsage(projectId, id)).length > 0 ? id : null))
  );
  return used.filter((id): id is string => id !== null);
}
