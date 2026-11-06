import {
  elementNodeSchema,
  isLive,
  themeCss,
  usedClassNames,
  pageSettingsSchema,
  projectSettingsSchema,
  templateSettingsSchema,
  type ProjectSettings,
  type PublishedPage,
  type PublishedTemplate
} from "@nextomic/schema";
import { getDb, pages, projects, templates, user } from "@nextomic/db";
import { and, asc, eq } from "drizzle-orm";
import { getProjectSettings } from "./pages";

// Publishing copies the saved draft of every included page into a snapshot that visitors read.
// Drafts are never served publicly. Callers of publish/unpublish/getPublishState MUST have passed
// requireProjectAccess; the public readers below take no session on purpose.

export interface PublishState {
  publishedAt: Date | null;
  /** Pages that went out in the last publish. */
  publishedPages: number;
  /** True when the saved draft differs from what is live (or nothing is live yet). */
  hasUnpublishedChanges: boolean;
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

/** What publishing would write for a page row, or null when the page is left out. */
export function snapshotOfPage(row: {
  name: string;
  route: string;
  settings: unknown;
  tree: unknown;
}) {
  const settings = pageSettingsSchema.parse(row.settings);
  if (settings.status === "draft") return null;
  return { name: row.name, route: row.route, settings, tree: elementNodeSchema.parse(row.tree) };
}

/** What publishing would write for a template row: only published templates go out. */
export function templateSnapshotOf(row: {
  id: string;
  type: "header" | "footer" | "error-404";
  name: string;
  settings: unknown;
  tree: unknown;
}): PublishedTemplate | null {
  const settings = templateSettingsSchema.parse(row.settings);
  if (settings.status !== "published") return null;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    settings,
    tree: elementNodeSchema.parse(row.tree)
  };
}

export async function getPublishState(projectId: string): Promise<PublishState> {
  const db = getDb();
  const [project] = await db
    .select({
      publishedAt: projects.publishedAt,
      publishedSettings: projects.publishedSettings
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const rows = await db.select().from(pages).where(eq(pages.projectId, projectId));
  const templateRows = await db.select().from(templates).where(eq(templates.projectId, projectId));
  const publishedAt = project?.publishedAt ?? null;
  let hasUnpublishedChanges = publishedAt === null;
  if (publishedAt !== null) {
    const live = projectSettingsSchema.safeParse(project?.publishedSettings);
    const current = await getProjectSettings(projectId);
    hasUnpublishedChanges =
      !live.success ||
      stable(live.data) !== stable(current) ||
      rows.some((row) => stable(row.publishedSnapshot) !== stable(snapshotOfPage(row))) ||
      templateRows.some((row) => stable(row.publishedSnapshot) !== stable(templateSnapshotOf(row)));
  }
  return {
    publishedAt,
    publishedPages: rows.filter((row) => row.publishedSnapshot !== null).length,
    hasUnpublishedChanges
  };
}

export async function publishProject(projectId: string): Promise<PublishState> {
  const settings = await getProjectSettings(projectId);
  const publishedAt = new Date();
  await getDb().transaction(async (tx) => {
    const rows = await tx.select().from(pages).where(eq(pages.projectId, projectId));
    for (const row of rows) {
      const snapshot: PublishedPage | null = snapshotOfPage(row);
      await tx
        .update(pages)
        .set({ publishedSnapshot: snapshot, publishedAt: snapshot ? publishedAt : null })
        .where(and(eq(pages.id, row.id), eq(pages.projectId, projectId)));
    }
    const templateRows = await tx
      .select()
      .from(templates)
      .where(eq(templates.projectId, projectId));
    for (const row of templateRows) {
      const snapshot = templateSnapshotOf(row);
      await tx
        .update(templates)
        .set({ publishedSnapshot: snapshot, publishedAt: snapshot ? publishedAt : null })
        .where(and(eq(templates.id, row.id), eq(templates.projectId, projectId)));
    }
    await tx
      .update(projects)
      .set({ publishedAt, publishedSettings: settings })
      .where(eq(projects.id, projectId));
  });
  return getPublishState(projectId);
}

export async function unpublishProject(projectId: string): Promise<PublishState> {
  await getDb().transaction(async (tx) => {
    await tx
      .update(pages)
      .set({ publishedSnapshot: null, publishedAt: null })
      .where(eq(pages.projectId, projectId));
    await tx
      .update(templates)
      .set({ publishedSnapshot: null, publishedAt: null })
      .where(eq(templates.projectId, projectId));
    await tx
      .update(projects)
      .set({ publishedAt: null, publishedSettings: null })
      .where(eq(projects.id, projectId));
  });
  return getPublishState(projectId);
}

export interface PublishedView {
  /** When the live version was published; used to version asset URLs. */
  publishedAt: Date;
  page: PublishedPage;
  /** Id of the page row; theme conditions match on it. */
  pageId: string;
  /** Facts about the page for {{page.*}} tags and rules. */
  meta: { createdBy: string; createdAt: string; updatedAt: string; publishedAt: string };
  settings: ProjectSettings;
}

/**
 * Public read. `route` null means the home page. Pages that require sign-in are not served
 * publicly until end-user authentication exists (docs/app-auth.md).
 */
export async function getPublishedView(
  projectId: string,
  route: string | null
): Promise<PublishedView | null> {
  const db = getDb();
  const [project] = await db
    .select({ publishedAt: projects.publishedAt, settings: projects.publishedSettings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project?.publishedAt) return null;
  const rows = await db
    .select({
      id: pages.id,
      snapshot: pages.publishedSnapshot,
      createdAt: pages.createdAt,
      updatedAt: pages.updatedAt,
      publishedAt: pages.publishedAt,
      creator: user.name
    })
    .from(pages)
    .leftJoin(user, eq(user.id, pages.createdBy))
    .where(eq(pages.projectId, projectId))
    .orderBy(asc(pages.createdAt));
  const now = Date.now();
  const snapshots = rows.flatMap((row) =>
    // A scheduled page is part of the live snapshot but is only served once its time has come.
    row.snapshot && isLive(pageSettingsSchema.parse(row.snapshot.settings), now)
      ? [
          {
            ...row.snapshot,
            id: row.id,
            meta: {
              createdBy: row.creator ?? "",
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
              publishedAt: row.publishedAt?.toISOString() ?? ""
            }
          }
        ]
      : []
  );
  const found =
    route === null
      ? (snapshots.find((p) => p.settings.isHome) ?? snapshots[0])
      : snapshots.find((p) => p.route === route);
  if (!found || found.settings.requiresAuth) return null;
  const settings = projectSettingsSchema.safeParse(project.settings);
  if (!settings.success) return null;
  return {
    publishedAt: project.publishedAt,
    pageId: found.id,
    meta: found.meta,
    page: {
      name: found.name,
      route: found.route,
      settings: pageSettingsSchema.parse(found.settings),
      tree: elementNodeSchema.parse(found.tree)
    },
    settings: settings.data
  };
}

/**
 * The CSS file of one theme of the live site: variables per mode and the framework classes that
 * any published page uses. Public read, no session. Null when nothing is published or the theme
 * does not exist.
 */
export async function getPublishedThemeCss(
  projectId: string,
  slug: string
): Promise<{ css: string; publishedAt: Date } | null> {
  const db = getDb();
  const [project] = await db
    .select({ publishedAt: projects.publishedAt, settings: projects.publishedSettings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project?.publishedAt) return null;
  const settings = projectSettingsSchema.safeParse(project.settings);
  if (!settings.success) return null;
  const theme = settings.data.themes.find((t) => t.slug === slug);
  if (!theme) return null;
  const rows = await db
    .select({ snapshot: pages.publishedSnapshot })
    .from(pages)
    .where(eq(pages.projectId, projectId));
  const used = new Set<string>();
  for (const row of rows) {
    if (!row.snapshot) continue;
    const tree = elementNodeSchema.safeParse(row.snapshot.tree);
    if (tree.success) for (const name of usedClassNames(tree.data)) used.add(name);
  }
  return { css: themeCss(theme, used), publishedAt: project.publishedAt };
}

/** Public read: the project settings of the live site, or null when nothing is published. */
export async function getPublishedSite(
  projectId: string
): Promise<{ settings: ProjectSettings; publishedAt: Date } | null> {
  const [project] = await getDb()
    .select({ publishedAt: projects.publishedAt, settings: projects.publishedSettings })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project?.publishedAt) return null;
  const settings = projectSettingsSchema.safeParse(project.settings);
  return settings.success ? { settings: settings.data, publishedAt: project.publishedAt } : null;
}
