import {
  defaultPageSettings,
  newPageRequiresAuth,
  defaultProjectSettings,
  countClassUsage,
  countFamilyInTree,
  countVariableUsageInTree,
  VERSION_LIMIT_MAX,
  effectiveVersionLimit,
  pageTreeSchema,
  emptyPageTree,
  pageSettingsSchema,
  projectSettingsSchema,
  renameCssVarsInTree,
  renameVariableInTree,
  replaceClassInTree,
  type ElementNode,
  type PageSettings,
  type ProjectSettings,
  type SavePageInput
} from "@nextomic/schema";
import { getDb, pages, pageVersions, projects } from "@nextomic/db";
import { and, asc, desc, eq, ne, notInArray, sql } from "drizzle-orm";

// Page persistence. Callers MUST have passed requireProjectAccess for the project first;
// every query here is also scoped by projectId so a page id from another project never matches.

export interface StoredPage {
  id: string;
  projectId: string;
  name: string;
  route: string;
  settings: PageSettings;
  tree: ElementNode;
  version: number;
  updatedAt: Date;
}

export interface PageSummary {
  id: string;
  name: string;
  route: string;
  version: number;
  isHome: boolean;
}

export type SaveResult =
  | { ok: true; page: StoredPage }
  | { ok: false; reason: "conflict"; page: StoredPage }
  | { ok: false; reason: "route-taken" | "not-found" };

function toStored(row: typeof pages.$inferSelect): StoredPage {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    route: row.route,
    settings: pageSettingsSchema.parse(row.settings),
    tree: pageTreeSchema.parse(row.tree),
    version: row.version,
    updatedAt: row.updatedAt
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function getProjectSettings(projectId: string): Promise<ProjectSettings> {
  const db = getDb();
  const [row] = await db
    .select({ settings: projects.settings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row?.settings) return defaultProjectSettings();
  const parsed = projectSettingsSchema.safeParse(row.settings);
  return parsed.success ? parsed.data : defaultProjectSettings();
}

export async function saveProjectSettings(
  projectId: string,
  settings: ProjectSettings
): Promise<ProjectSettings> {
  const valid = projectSettingsSchema.parse(settings);
  await getDb()
    .update(projects)
    .set({ settings: valid, lastModifiedAt: new Date() })
    .where(eq(projects.id, projectId));
  return valid;
}

export async function listPages(projectId: string): Promise<PageSummary[]> {
  const rows = await getDb()
    .select({
      id: pages.id,
      name: pages.name,
      route: pages.route,
      version: pages.version,
      settings: pages.settings
    })
    .from(pages)
    .where(eq(pages.projectId, projectId))
    .orderBy(asc(pages.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    route: row.route,
    version: row.version,
    isHome: pageSettingsSchema.parse(row.settings).isHome
  }));
}

export async function getPage(projectId: string, pageId: string): Promise<StoredPage | null> {
  const [row] = await getDb()
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
    .limit(1);
  return row ? toStored(row) : null;
}

export async function getPageByRoute(projectId: string, route: string): Promise<StoredPage | null> {
  const [row] = await getDb()
    .select()
    .from(pages)
    .where(and(eq(pages.projectId, projectId), eq(pages.route, route)))
    .limit(1);
  return row ? toStored(row) : null;
}

export async function createPage(
  projectId: string,
  userId: string,
  input: { name: string; route: string; isHome?: boolean }
): Promise<StoredPage | "route-taken"> {
  const project = await getProjectSettings(projectId);
  const settings = {
    ...defaultPageSettings(),
    isHome: input.isHome ?? false,
    // App Settings > Authentication can make new pages require sign-in.
    requiresAuth: newPageRequiresAuth(project.appAuth)
  };
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(pages)
        .values({
          projectId,
          name: input.name,
          route: input.route,
          settings,
          tree: emptyPageTree(),
          createdBy: userId
        })
        .returning();
      if (!row) throw new Error("Page insert returned no row");
      await tx.insert(pageVersions).values({
        pageId: row.id,
        version: row.version,
        name: row.name,
        route: row.route,
        settings: row.settings,
        tree: row.tree,
        savedBy: userId
      });
      return toStored(row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "route-taken";
    throw error;
  }
}

/** The first time a project is opened it gets a Home page at "/". */
export async function ensureHomePage(projectId: string, userId: string): Promise<void> {
  const existing = await listPages(projectId);
  if (existing.length > 0) return;
  await createPage(projectId, userId, { name: "Home", route: "/", isHome: true });
}

export async function savePage(
  projectId: string,
  pageId: string,
  userId: string,
  input: SavePageInput
): Promise<SaveResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(pages)
        .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
        .for("update")
        .limit(1);
      if (!current) return { ok: false, reason: "not-found" } as const;
      if (current.version !== input.baseVersion) {
        return { ok: false, reason: "conflict", page: toStored(current) } as const;
      }
      const [row] = await tx
        .update(pages)
        .set({
          name: input.name ?? current.name,
          route: input.route ?? current.route,
          settings: input.settings ?? current.settings,
          tree: input.tree ?? current.tree,
          version: current.version + 1,
          updatedAt: new Date()
        })
        .where(eq(pages.id, pageId))
        .returning();
      if (!row) throw new Error("Page update returned no row");
      const [projectRow] = await tx
        .select({ settings: projects.settings })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      const project = projectSettingsSchema.safeParse(projectRow?.settings ?? {});
      const versionControl =
        (project.success ? project.data.versionControl : true) && row.settings.versionControl;
      if (versionControl) {
        await tx.insert(pageVersions).values({
          pageId,
          version: row.version,
          name: row.name,
          route: row.route,
          settings: row.settings,
          tree: row.tree,
          savedBy: userId
        });
        const limit = effectiveVersionLimit(
          project.success ? project.data : defaultProjectSettings(),
          row.settings
        );
        await pruneVersions(tx, pageId, limit);
      }
      if (row.settings.isHome) {
        // Only one home page per project.
        await tx
          .update(pages)
          .set({ settings: sql`jsonb_set(${pages.settings}, '{isHome}', 'false'::jsonb)` })
          .where(
            and(
              eq(pages.projectId, projectId),
              ne(pages.id, pageId),
              sql`${pages.settings}->>'isHome' = 'true'`
            )
          );
      }
      await tx
        .update(projects)
        .set({ lastModifiedAt: new Date() })
        .where(eq(projects.id, projectId));
      return { ok: true, page: toStored(row) } as const;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "route-taken" };
    throw error;
  }
}

/** Copies a page (tree and settings) to a new route: /about -> /about-copy, /about-copy-2, ... */
export async function duplicatePage(
  projectId: string,
  pageId: string,
  userId: string
): Promise<StoredPage | null> {
  const source = await getPage(projectId, pageId);
  if (!source) return null;
  const settings = { ...source.settings, isHome: false };
  const base = source.route === "/" ? "/home" : source.route;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const route = attempt === 1 ? `${base}-copy` : `${base}-copy-${attempt}`;
    const created = await createPage(projectId, userId, { name: `${source.name} copy`, route });
    if (created === "route-taken") continue;
    const saved = await savePage(projectId, created.id, userId, {
      baseVersion: created.version,
      settings,
      tree: source.tree
    });
    return saved.ok ? saved.page : null;
  }
  return null;
}

export async function deletePage(projectId: string, pageId: string): Promise<boolean> {
  const removed = await getDb()
    .delete(pages)
    .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
    .returning({ id: pages.id });
  return removed.length > 0;
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Keeps the newest `limit` snapshots of a page and deletes the rest. */
async function pruneVersions(tx: Tx, pageId: string, limit: number): Promise<void> {
  const keep = tx
    .select({ version: pageVersions.version })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.version))
    .limit(limit);
  await tx
    .delete(pageVersions)
    .where(and(eq(pageVersions.pageId, pageId), notInArray(pageVersions.version, keep)));
}

export interface VersionSummary {
  version: number;
  name: string;
  savedAt: Date;
  savedBy: string | null;
}

export async function listVersions(projectId: string, pageId: string): Promise<VersionSummary[]> {
  const owned = await getPage(projectId, pageId);
  if (!owned) return [];
  const rows = await getDb()
    .select({
      version: pageVersions.version,
      name: pageVersions.name,
      savedAt: pageVersions.createdAt,
      savedBy: pageVersions.savedBy
    })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.version))
    .limit(VERSION_LIMIT_MAX);
  return rows;
}

/** Restoring writes the old snapshot as a NEW version so history is never rewritten. */
export async function restoreVersion(
  projectId: string,
  pageId: string,
  userId: string,
  version: number
): Promise<SaveResult> {
  const current = await getPage(projectId, pageId);
  if (!current) return { ok: false, reason: "not-found" };
  const [snapshot] = await getDb()
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.pageId, pageId), eq(pageVersions.version, version)))
    .limit(1);
  if (!snapshot) return { ok: false, reason: "not-found" };
  return savePage(projectId, pageId, userId, {
    baseVersion: current.version,
    name: snapshot.name,
    route: snapshot.route,
    settings: pageSettingsSchema.parse(snapshot.settings),
    tree: pageTreeSchema.parse(snapshot.tree)
  });
}

export async function countPages(projectId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(pages)
    .where(eq(pages.projectId, projectId));
  return row?.count ?? 0;
}

/** Class usage over the saved pages of a project, leaving out `exceptPageId` (the editor counts that one live). */
export async function classUsageInOtherPages(
  projectId: string,
  exceptPageId: string
): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ tree: pages.tree })
    .from(pages)
    .where(and(eq(pages.projectId, projectId), ne(pages.id, exceptPageId)));
  const counts: Record<string, number> = {};
  for (const row of rows) countClassUsage(pageTreeSchema.parse(row.tree), counts);
  return counts;
}

/** Renames (or, with `to` null, removes) a class on every saved page except `exceptPageId`. */
export async function replaceClassInOtherPages(
  projectId: string,
  exceptPageId: string,
  from: string,
  to: string | null
): Promise<number> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ id: pages.id, tree: pages.tree })
      .from(pages)
      .where(and(eq(pages.projectId, projectId), ne(pages.id, exceptPageId)));
    let updated = 0;
    for (const row of rows) {
      const tree = pageTreeSchema.parse(row.tree);
      if (!replaceClassInTree(tree, from, to)) continue;
      await tx
        .update(pages)
        .set({ tree, version: sql`${pages.version} + 1`, updatedAt: new Date() })
        .where(and(eq(pages.id, row.id), eq(pages.projectId, projectId)));
      updated += 1;
    }
    return updated;
  });
}

/** Variable references on the saved pages of a project, leaving out `exceptPageId`. */
export async function variableUsageInOtherPages(
  projectId: string,
  exceptPageId: string
): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ tree: pages.tree })
    .from(pages)
    .where(and(eq(pages.projectId, projectId), ne(pages.id, exceptPageId)));
  const counts: Record<string, number> = {};
  for (const row of rows) countVariableUsageInTree(pageTreeSchema.parse(row.tree), counts);
  return counts;
}

/** Points references of variable `from` at `to` on every saved page except `exceptPageId`. */
export async function renameVariableInOtherPages(
  projectId: string,
  exceptPageId: string,
  from: string,
  to: string
): Promise<number> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ id: pages.id, tree: pages.tree })
      .from(pages)
      .where(and(eq(pages.projectId, projectId), ne(pages.id, exceptPageId)));
    let updated = 0;
    for (const row of rows) {
      const tree = pageTreeSchema.parse(row.tree);
      if (!renameVariableInTree(tree, from, to)) continue;
      await tx
        .update(pages)
        .set({ tree, version: sql`${pages.version} + 1`, updatedAt: new Date() })
        .where(and(eq(pages.id, row.id), eq(pages.projectId, projectId)));
      updated += 1;
    }
    return updated;
  });
}

/** Points `var(--from)` at `var(--to)` for every pair on every saved page except `exceptPageId`. */
export async function renameCssVarsInOtherPages(
  projectId: string,
  exceptPageId: string,
  pairs: readonly (readonly [string, string])[]
): Promise<number> {
  const renames = new Map(pairs);
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ id: pages.id, tree: pages.tree })
      .from(pages)
      .where(and(eq(pages.projectId, projectId), ne(pages.id, exceptPageId)));
    let updated = 0;
    for (const row of rows) {
      const tree = pageTreeSchema.parse(row.tree);
      if (!renameCssVarsInTree(tree, renames)) continue;
      await tx
        .update(pages)
        .set({ tree, version: sql`${pages.version} + 1`, updatedAt: new Date() })
        .where(and(eq(pages.id, row.id), eq(pages.projectId, projectId)));
      updated += 1;
    }
    return updated;
  });
}

/** Elements naming each family in their styles, on every saved page except `exceptPageId`. */
export async function fontUsageInOtherPages(
  projectId: string,
  exceptPageId: string,
  families: readonly string[]
): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ tree: pages.tree })
    .from(pages)
    .where(and(eq(pages.projectId, projectId), ne(pages.id, exceptPageId)));
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const tree = pageTreeSchema.parse(row.tree);
    for (const family of families) {
      const n = countFamilyInTree(tree, family);
      if (n > 0) counts[family] = (counts[family] ?? 0) + n;
    }
  }
  return counts;
}

/** Makes one page the project's home page; every other page stops being home. */
export async function setHomePage(projectId: string, pageId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)))
      .limit(1);
    if (!target) return false;
    await tx
      .update(pages)
      .set({ settings: sql`jsonb_set(${pages.settings}, '{isHome}', 'false'::jsonb)` })
      .where(and(eq(pages.projectId, projectId), ne(pages.id, pageId)));
    await tx
      .update(pages)
      .set({ settings: sql`jsonb_set(${pages.settings}, '{isHome}', 'true'::jsonb)` })
      .where(eq(pages.id, pageId));
    return true;
  });
}
