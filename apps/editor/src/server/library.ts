import { pageSettingsSchema, templateSettingsSchema, type TemplateType } from "@nextomic/schema";
import { getDb, pages, templates, user } from "@nextomic/db";
import { asc, eq } from "drizzle-orm";
import { snapshotOfPage, templateSnapshotOf } from "./publish";

// The Pages & Templates manager reads one flat list of both kinds.

export type LibraryStatus = "draft" | "published" | "modified" | "scheduled";

export interface LibraryItem {
  kind: "page" | "template";
  id: string;
  name: string;
  /** Pages only. */
  route: string | null;
  /** Templates only. */
  type: TemplateType | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  status: LibraryStatus;
  /** False when a page is left out of publishing, or a template is a draft. */
  live: boolean;
  categoryIds: string[];
  tagIds: string[];
  screenshotAt: string | null;
}

const stable = (value: unknown): string => JSON.stringify(value);

/** Draft: not going out. Published: live and unchanged. Modified: live, but the draft has changed since. */
function statusOf(live: unknown, current: unknown): LibraryStatus {
  if (current === null || live === null || live === undefined) return "draft";
  return stable(live) === stable(current) ? "published" : "modified";
}

export async function listLibrary(projectId: string): Promise<LibraryItem[]> {
  const db = getDb();
  const pageRows = await db
    .select({ page: pages, creator: user.name })
    .from(pages)
    .leftJoin(user, eq(user.id, pages.createdBy))
    .where(eq(pages.projectId, projectId))
    .orderBy(asc(pages.createdAt));
  const templateRows = await db
    .select({ template: templates, creator: user.name })
    .from(templates)
    .leftJoin(user, eq(user.id, templates.createdBy))
    .where(eq(templates.projectId, projectId))
    .orderBy(asc(templates.createdAt));

  const items: LibraryItem[] = [];
  for (const { page, creator } of pageRows) {
    const settings = pageSettingsSchema.parse(page.settings);
    items.push({
      kind: "page",
      id: page.id,
      name: page.name,
      route: page.route,
      type: null,
      createdBy: creator ?? "",
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      publishedAt: page.publishedAt?.toISOString() ?? null,
      status:
        settings.status === "scheduled"
          ? "scheduled"
          : statusOf(page.publishedSnapshot, snapshotOfPage(page)),
      live: settings.status !== "draft",
      categoryIds: settings.categoryIds,
      tagIds: settings.tagIds,
      screenshotAt: page.screenshotAt?.toISOString() ?? null
    });
  }
  for (const { template, creator } of templateRows) {
    const settings = templateSettingsSchema.parse(template.settings);
    items.push({
      kind: "template",
      id: template.id,
      name: template.name,
      route: null,
      type: template.type,
      createdBy: creator ?? "",
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      publishedAt: template.publishedAt?.toISOString() ?? null,
      status:
        settings.status === "scheduled"
          ? "scheduled"
          : statusOf(template.publishedSnapshot, templateSnapshotOf(template)),
      live: settings.status !== "draft",
      categoryIds: settings.categoryIds,
      tagIds: settings.tagIds,
      screenshotAt: template.screenshotAt?.toISOString() ?? null
    });
  }
  return items;
}
