import {
  elementNodeSchema,
  pageSettingsSchema,
  projectSettingsSchema,
  type ProjectSettings,
  type PublishedPage
} from "@nextomic/schema";
import { getDb, pages, projects } from "@nextomic/db";
import { and, asc, eq } from "drizzle-orm";
import { getProjectSettings } from "./pages";

// Publishing copies the saved draft of every included page into a snapshot that visitors read.
// Drafts are never served publicly. Callers of publish/unpublish/getPublishState MUST have passed
// requireProjectAccess; the public readers below take no session on purpose.

export interface PublishState {
  publishedAt: Date | null;
  /** Pages that went out in the last publish. */
  publishedPages: number;
}

export async function getPublishState(projectId: string): Promise<PublishState> {
  const db = getDb();
  const [project] = await db
    .select({ publishedAt: projects.publishedAt })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const rows = await db
    .select({ snapshot: pages.publishedSnapshot })
    .from(pages)
    .where(eq(pages.projectId, projectId));
  return {
    publishedAt: project?.publishedAt ?? null,
    publishedPages: rows.filter((row) => row.snapshot !== null).length
  };
}

export async function publishProject(projectId: string): Promise<PublishState> {
  const settings = await getProjectSettings(projectId);
  const publishedAt = new Date();
  await getDb().transaction(async (tx) => {
    const rows = await tx.select().from(pages).where(eq(pages.projectId, projectId));
    for (const row of rows) {
      const pageSettings = pageSettingsSchema.parse(row.settings);
      const snapshot: PublishedPage | null = pageSettings.includeInPublish
        ? {
            name: row.name,
            route: row.route,
            settings: pageSettings,
            tree: elementNodeSchema.parse(row.tree)
          }
        : null;
      await tx
        .update(pages)
        .set({ publishedSnapshot: snapshot })
        .where(and(eq(pages.id, row.id), eq(pages.projectId, projectId)));
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
    await tx.update(pages).set({ publishedSnapshot: null }).where(eq(pages.projectId, projectId));
    await tx
      .update(projects)
      .set({ publishedAt: null, publishedSettings: null })
      .where(eq(projects.id, projectId));
  });
  return getPublishState(projectId);
}

export interface PublishedView {
  page: PublishedPage;
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
    .select({ snapshot: pages.publishedSnapshot })
    .from(pages)
    .where(eq(pages.projectId, projectId))
    .orderBy(asc(pages.createdAt));
  const snapshots = rows.flatMap((row) => (row.snapshot ? [row.snapshot] : []));
  const found =
    route === null
      ? (snapshots.find((p) => p.settings.isHome) ?? snapshots[0])
      : snapshots.find((p) => p.route === route);
  if (!found || found.settings.requiresAuth) return null;
  const settings = projectSettingsSchema.safeParse(project.settings);
  if (!settings.success) return null;
  return {
    page: {
      name: found.name,
      route: found.route,
      settings: pageSettingsSchema.parse(found.settings),
      tree: elementNodeSchema.parse(found.tree)
    },
    settings: settings.data
  };
}
