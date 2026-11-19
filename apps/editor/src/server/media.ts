import { randomUUID } from "node:crypto";
import {
  actionBlocks,
  actionFlows,
  getDb,
  mediaAssets,
  mediaLibrary,
  mediaFolders,
  pages,
  projects,
  templates
} from "@nextomic/db";
import {
  MEDIA_ID,
  MEDIA_LARGE_BYTES,
  MEDIA_MAX_BYTES,
  MEDIA_PAGE_SIZE,
  isUuid,
  mediaKindOf,
  mimeTopLevel,
  imageSize,
  mediaEditSchema,
  mediaFileName,
  mediaFolderNameSchema,
  mediaPath,
  mediaQuerySchema,
  mediaTagsSchema,
  mediaTitleFromName,
  formatBytes,
  refuseReason,
  sanitizeSvg,
  sniffMedia,
  SvgError,
  type MediaAsset,
  type MediaKind,
  type MediaCounts,
  type MediaEdit,
  type MediaFolder,
  type MediaQuery,
  type MediaUsage
} from "@nextomic/schema";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { StorageExistsError } from "@nextomic/storage";
import { getStorageAdapter } from "@/lib/storage";
import { BUCKETS, mediaObjectPath } from "./storage-paths";
import { isQueuedForDeletion, queueObjectDeletion } from "./storage-cleanup";
import { deleteVariants } from "./media-variants";
import { createRateLimiter } from "./rate-limit";

// Media library persistence. Callers MUST have passed authorizeProject for the project; every query
// is also scoped by projectId, so an id from another project never matches. A row holds only what
// storage does not know (name, alt text, tags, folder, resolution) and links to its storage object;
// the file name, type, size and ETag are read from storage.objects through the media_library view.
// Bytes are served by app/media/[projectId]/[assetId]/[file].

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

type Row = typeof mediaLibrary.$inferSelect;

/** The mime top level (image, video, ...) of a library row, read from the storage object's type. */
const topLevel = sql`split_part(${mediaLibrary.mime}, '/', 1)`;

/** SQL for one library kind. SVG is an image whose mime type says so; "other" is everything but images and video. */
function kindCondition(kind: MediaKind): SQL {
  switch (kind) {
    case "svg":
      return eq(mediaLibrary.mime, "image/svg+xml");
    case "image":
      return sql`${topLevel} = 'image' and ${mediaLibrary.mime} <> 'image/svg+xml'`;
    case "video":
      return sql`${topLevel} = 'video'`;
    case "audio":
      return sql`${topLevel} = 'audio'`;
    case "other":
      return sql`${topLevel} not in ('image', 'video', 'audio')`;
  }
}

function toAsset(row: Row): MediaAsset {
  return {
    id: row.id,
    folderId: row.folderId,
    title: row.title,
    fileName: row.fileName,
    kind: mediaKindOf(row.mime),
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
  if (!isUuid(projectId)) throw new MediaError("Invalid project.");
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
  const where: SQL[] = [eq(mediaLibrary.projectId, projectId)];
  where.push(
    q.filter === "trash" ? isNotNull(mediaLibrary.trashedAt) : isNull(mediaLibrary.trashedAt)
  );
  if (q.folderId) where.push(eq(mediaLibrary.folderId, q.folderId));
  switch (q.filter) {
    case "missing-alt":
      where.push(sql`${topLevel} = 'image'`, eq(mediaLibrary.alt, ""));
      break;
    case "untagged":
      where.push(sql`jsonb_array_length(${mediaLibrary.tags}) = 0`);
      break;
    case "large":
      where.push(sql`${mediaLibrary.size} > ${MEDIA_LARGE_BYTES}`);
      break;
    case "replaced":
      where.push(isNotNull(mediaLibrary.replacedAt));
      break;
  }
  if (q.kinds && q.kinds.length > 0) {
    const any = or(...q.kinds.map(kindCondition));
    if (any) where.push(any);
  }
  if (q.type === "other") where.push(sql`${topLevel} not in ('image', 'video')`);
  else if (q.type !== "all") where.push(kindCondition(q.type));
  if (q.search) {
    const like = `%${escapeLike(q.search.toLowerCase())}%`;
    where.push(
      or(
        sql`lower(${mediaLibrary.title}) like ${like}`,
        sql`lower(${mediaLibrary.fileName}) like ${like}`,
        sql`lower(${mediaLibrary.alt}) like ${like}`,
        sql`lower(${mediaLibrary.tags}::text) like ${like}`
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
      ? asc(mediaLibrary.createdAt)
      : q.sort === "name"
        ? asc(sql`lower(coalesce(nullif(${mediaLibrary.title}, ''), ${mediaLibrary.fileName}))`)
        : q.sort === "size"
          ? desc(mediaLibrary.size)
          : desc(mediaLibrary.createdAt);
  const db = getDb();
  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(mediaLibrary)
      .where(where)
      .orderBy(order, asc(mediaLibrary.id))
      .limit(MEDIA_PAGE_SIZE)
      .offset(q.offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(mediaLibrary)
      .where(where)
  ]);
  return { assets: rows.map(toAsset), total: count?.n ?? 0 };
}

export async function mediaCounts(projectId: string): Promise<MediaCounts> {
  assertProjectId(projectId);
  const db = getDb();
  const live = isNull(mediaLibrary.trashedAt);
  const [[row], folders] = await Promise.all([
    db
      .select({
        all: sql<number>`count(*) filter (where ${live})::int`,
        missingAlt: sql<number>`count(*) filter (where ${live} and ${topLevel} = 'image' and ${mediaLibrary.alt} = '')::int`,
        untagged: sql<number>`count(*) filter (where ${live} and jsonb_array_length(${mediaLibrary.tags}) = 0)::int`,
        large: sql<number>`count(*) filter (where ${live} and ${mediaLibrary.size} > ${MEDIA_LARGE_BYTES})::int`,
        replaced: sql<number>`count(*) filter (where ${live} and ${mediaLibrary.replacedAt} is not null)::int`,
        trash: sql<number>`count(*) filter (where ${mediaLibrary.trashedAt} is not null)::int`
      })
      .from(mediaLibrary)
      .where(eq(mediaLibrary.projectId, projectId)),
    db
      .select({ id: mediaLibrary.folderId, n: sql<number>`count(*)::int` })
      .from(mediaLibrary)
      .where(and(eq(mediaLibrary.projectId, projectId), live, isNotNull(mediaLibrary.folderId)))
      .groupBy(mediaLibrary.folderId)
  ]);
  const byFolder: Record<string, number> = {};
  for (const f of folders) if (f.id) byFolder[f.id] = f.n;
  return {
    all: row?.all ?? 0,
    missingAlt: row?.missingAlt ?? 0,
    untagged: row?.untagged ?? 0,
    large: row?.large ?? 0,
    replaced: row?.replaced ?? 0,
    trash: row?.trash ?? 0,
    byFolder
  };
}

export async function getMedia(projectId: string, id: string): Promise<MediaAsset | null> {
  if (!isUuid(projectId) || !MEDIA_ID.test(id)) return null;
  const [row] = await getDb()
    .select()
    .from(mediaLibrary)
    .where(and(eq(mediaLibrary.id, id), eq(mediaLibrary.projectId, projectId)))
    .limit(1);
  return row ? toAsset(row) : null;
}

/** The storage path of an asset's file, read through the link to storage.objects. */
async function objectNameOf(projectId: string, id: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ name: mediaLibrary.objectName })
    .from(mediaLibrary)
    .where(and(eq(mediaLibrary.id, id), eq(mediaLibrary.projectId, projectId)))
    .limit(1);
  return row?.name ?? null;
}

/** The stored bytes of an asset; null when they are gone from storage. */
export async function readMediaBytes(projectId: string, id: string): Promise<Uint8Array | null> {
  const path = await objectNameOf(projectId, id);
  return path ? getStorageAdapter().get({ bucket: BUCKETS.appUploads, path }) : null;
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
  input: Uint8Array,
  assetId: string
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
  return { data, format, fileName: mediaFileName(name, format.ext, assetId) };
}

/** Removes an asset's file and its resized copies; failures are retried by the periodic cleanup. */
const dropAssetFiles = async (projectId: string, id: string, objectName: string): Promise<void> => {
  await queueObjectDeletion(BUCKETS.appUploads, objectName).catch(() => undefined);
  await deleteVariants(projectId, id);
};

/** `photo.png` -> `photo-2.png`, `photo-3.png`, ... */
const numbered = (fileName: string, n: number): string => {
  if (n === 1) return fileName;
  const dot = fileName.lastIndexOf(".");
  return `${fileName.slice(0, dot)}-${n}${fileName.slice(dot)}`;
};

const MAX_NAME_TRIES = 100;

/**
 * Uploads the file under its own name in the project's type folder. A name that is taken (by
 * another file, or by one waiting to be removed) gets `-2`, `-3`, ... before the extension.
 */
async function putUnique(
  projectId: string,
  mime: string,
  fileName: string,
  data: Uint8Array
): Promise<{ objectName: string; objectId: string }> {
  const storage = getStorageAdapter();
  for (let n = 1; n <= MAX_NAME_TRIES; n++) {
    const location = await mediaObjectPath(projectId, mimeTopLevel(mime), numbered(fileName, n));
    if (await isQueuedForDeletion(location.bucket, location.path)) continue;
    try {
      await storage.put({ ...location, data, contentType: mime, overwrite: false });
    } catch (error) {
      if (error instanceof StorageExistsError) continue;
      throw error;
    }
    const found = await getDb().execute<{ id: string }>(
      sql`select id from storage.objects where bucket_id = ${location.bucket} and name = ${location.path} limit 1`
    );
    const objectId = found.rows[0]?.id;
    if (!objectId) throw new MediaError("The file was uploaded but storage did not list it.");
    return { objectName: location.path, objectId };
  }
  throw new MediaError("Too many files share this name. Rename the file and try again.");
}

export async function storeMedia(
  projectId: string,
  userId: string,
  file: { name: string; data: Uint8Array; folderId?: string | null }
): Promise<MediaAsset> {
  assertProjectId(projectId);
  await assertFolder(projectId, file.folderId);
  const id = randomUUID();
  const { data, format, fileName } = prepareUpload(file.name, file.data, id);
  const dims = format.kind === "image" ? imageSize(data) : null;
  const stored = await putUnique(projectId, format.mime, fileName, data);
  try {
    await getDb()
      .insert(mediaAssets)
      .values({
        id,
        projectId,
        folderId: file.folderId ?? null,
        objectId: stored.objectId,
        title: mediaTitleFromName(file.name),
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        createdBy: userId
      });
    const created = await getMedia(projectId, id);
    if (!created) throw new MediaError("The file was uploaded but could not be read back.");
    return created;
  } catch (error) {
    await dropAssetFiles(projectId, id, stored.objectName);
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
  const objectName = current ? await objectNameOf(projectId, id) : null;
  if (!current || !objectName) throw new MediaError("That file no longer exists.");
  const { data, format } = prepareUpload(file.name, file.data, id);
  if (format.kind !== current.kind)
    throw new MediaError(
      `Replace it with another ${current.kind === "svg" ? "SVG" : current.kind} file.`
    );
  const dims = format.kind === "image" ? imageSize(data) : null;
  await getStorageAdapter().put({
    bucket: BUCKETS.appUploads,
    path: objectName,
    data,
    contentType: format.mime
  });
  await deleteVariants(projectId, id);
  await getDb()
    .update(mediaAssets)
    .set({
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      replacedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)));
  const replaced = await getMedia(projectId, id);
  if (!replaced) throw new MediaError("That file no longer exists.");
  return replaced;
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
  const done = await getDb()
    .update(mediaAssets)
    .set({ ...edit, updatedAt: new Date() })
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)))
    .returning({ id: mediaAssets.id });
  const edited = done.length > 0 ? await getMedia(projectId, id) : null;
  if (!edited) throw new MediaError("That file no longer exists.");
  return edited;
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
    const rows = await db
      .select({ id: mediaAssets.id, tags: mediaAssets.tags })
      .from(mediaAssets)
      .where(scope);
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
  const db = getDb();
  const rows = await db
    .select({ id: mediaLibrary.id, objectName: mediaLibrary.objectName })
    .from(mediaLibrary)
    .where(and(eq(mediaLibrary.projectId, projectId), where));
  if (rows.length === 0) return 0;
  await db.delete(mediaAssets).where(
    and(
      eq(mediaAssets.projectId, projectId),
      inArray(
        mediaAssets.id,
        rows.map((r) => r.id)
      )
    )
  );
  await Promise.all(rows.map((r) => dropAssetFiles(projectId, r.id, r.objectName)));
  return rows.length;
}

/** Deletes trashed files for good (storage bytes included). Only trashed files can be purged. */
export function purgeMedia(projectId: string, ids: readonly string[]): Promise<number> {
  assertProjectId(projectId);
  return purgeWhere(
    projectId,
    and(inArray(mediaLibrary.id, assertIds(ids)), isNotNull(mediaLibrary.trashedAt))
  );
}

export function emptyMediaTrash(projectId: string): Promise<number> {
  assertProjectId(projectId);
  return purgeWhere(projectId, isNotNull(mediaLibrary.trashedAt));
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
    ...settingsRows.map((): MediaUsage => ({
      kind: "settings",
      id: projectId,
      name: "Design system and settings"
    })),
    ...flowRows.map((r): MediaUsage => ({ kind: "action", id: String(r.id), name: "Action flow" })),
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
