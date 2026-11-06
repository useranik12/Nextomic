import {
  elementNodeSchema,
  emptyPageTree,
  templateSettingsSchema,
  defaultTemplateSettings,
  type ElementNode,
  type ItemStatus,
  type PublishedTemplate,
  type SaveTemplateInput,
  type TemplateSettings,
  type TemplateType
} from "@nextomic/schema";
import { getDb, projects, templates } from "@nextomic/db";
import { and, asc, eq } from "drizzle-orm";

// Template persistence. Callers MUST have passed requireProjectAccess for the project first; every
// query is also scoped by projectId so a template id from another project never matches.

export interface StoredTemplate {
  id: string;
  projectId: string;
  type: TemplateType;
  name: string;
  settings: TemplateSettings;
  tree: ElementNode;
  version: number;
  updatedAt: Date;
}

export type SaveTemplateResult =
  | { ok: true; template: StoredTemplate }
  | { ok: false; reason: "conflict"; template: StoredTemplate }
  | { ok: false; reason: "not-found" };

function toStored(row: typeof templates.$inferSelect): StoredTemplate {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    name: row.name,
    settings: templateSettingsSchema.parse(row.settings),
    tree: elementNodeSchema.parse(row.tree),
    version: row.version,
    updatedAt: row.updatedAt
  };
}

export interface TemplateSummary {
  id: string;
  name: string;
  type: TemplateType;
  status: ItemStatus;
  settings: TemplateSettings;
}

export async function listTemplates(projectId: string): Promise<TemplateSummary[]> {
  const rows = await getDb()
    .select()
    .from(templates)
    .where(eq(templates.projectId, projectId))
    .orderBy(asc(templates.createdAt));
  return rows.map((row) => {
    const settings = templateSettingsSchema.parse(row.settings);
    return { id: row.id, name: row.name, type: row.type, status: settings.status, settings };
  });
}

export async function getTemplate(
  projectId: string,
  templateId: string
): Promise<StoredTemplate | null> {
  const [row] = await getDb()
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.projectId, projectId)))
    .limit(1);
  return row ? toStored(row) : null;
}

/** A template's root is a page-shaped node, so the same canvas and tree code edit it. */
function templateTree(type: TemplateType): ElementNode {
  return { ...emptyPageTree(), name: type === "error-404" ? "404 page" : "Template" };
}

export async function createTemplate(
  projectId: string,
  userId: string,
  input: { name: string; type: TemplateType }
): Promise<StoredTemplate> {
  const [row] = await getDb()
    .insert(templates)
    .values({
      projectId,
      type: input.type,
      name: input.name,
      settings: defaultTemplateSettings(),
      tree: templateTree(input.type),
      createdBy: userId
    })
    .returning();
  if (!row) throw new Error("Template insert returned no row");
  return toStored(row);
}

export async function saveTemplate(
  projectId: string,
  templateId: string,
  input: SaveTemplateInput
): Promise<SaveTemplateResult> {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.projectId, projectId)))
      .for("update")
      .limit(1);
    if (!current) return { ok: false, reason: "not-found" } as const;
    if (current.version !== input.baseVersion)
      return { ok: false, reason: "conflict", template: toStored(current) } as const;
    const [row] = await tx
      .update(templates)
      .set({
        name: input.name ?? current.name,
        settings: input.settings ?? current.settings,
        tree: input.tree ?? current.tree,
        version: current.version + 1,
        updatedAt: new Date()
      })
      .where(eq(templates.id, templateId))
      .returning();
    if (!row) return { ok: false, reason: "not-found" } as const;
    return { ok: true, template: toStored(row) } as const;
  });
}

export async function duplicateTemplate(
  projectId: string,
  templateId: string,
  userId: string
): Promise<StoredTemplate | null> {
  const source = await getTemplate(projectId, templateId);
  if (!source) return null;
  const [row] = await getDb()
    .insert(templates)
    .values({
      projectId,
      type: source.type,
      name: `${source.name} copy`,
      settings: { ...source.settings, status: "draft" },
      tree: source.tree,
      createdBy: userId
    })
    .returning();
  return row ? toStored(row) : null;
}

export async function deleteTemplate(projectId: string, templateId: string): Promise<boolean> {
  const removed = await getDb()
    .delete(templates)
    .where(and(eq(templates.id, templateId), eq(templates.projectId, projectId)))
    .returning({ id: templates.id });
  return removed.length > 0;
}

/** Public read: the templates of the live site. No session on purpose. */
export async function getPublishedTemplates(projectId: string): Promise<PublishedTemplate[]> {
  const [project] = await getDb()
    .select({ publishedAt: projects.publishedAt })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project?.publishedAt) return [];
  const rows = await getDb()
    .select({ snapshot: templates.publishedSnapshot })
    .from(templates)
    .where(eq(templates.projectId, projectId))
    .orderBy(asc(templates.createdAt));
  return rows.flatMap((row) => (row.snapshot ? [row.snapshot] : []));
}

/** Owner preview: the saved drafts, so a template can be checked before it goes live. */
export async function getDraftTemplates(projectId: string): Promise<PublishedTemplate[]> {
  const rows = await getDb()
    .select()
    .from(templates)
    .where(eq(templates.projectId, projectId))
    .orderBy(asc(templates.createdAt));
  return rows.map((row) => {
    const stored = toStored(row);
    return {
      id: stored.id,
      type: stored.type,
      name: stored.name,
      settings: stored.settings,
      tree: stored.tree
    };
  });
}
