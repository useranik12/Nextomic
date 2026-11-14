import { actionBlocks, actionFlows, getDb, pages, templates } from "@nextomic/db";
import { iconKeySchema } from "@nextomic/schema";
import { and, eq, or, sql } from "drizzle-orm";

export interface IconUsage {
  kind: "page" | "template" | "action";
  id: string;
  name: string;
}

/**
 * Where an icon library is used: pages and templates (draft and published) and action flows. An
 * Icon element stores `"library": "<key>"` in its props, so a text search over the stored JSON
 * finds it, also in loop copies and nested elements. Library keys are letters, digits and dashes,
 * so the key is safe inside the LIKE pattern. A library in use cannot be removed (Design System
 * > Fonts & Icons), because its icons would silently stop drawing.
 */
export async function iconLibraryUsage(projectId: string, key: string): Promise<IconUsage[]> {
  const like = `%"library": "${iconKeySchema.parse(key)}"%`;
  const db = getDb();
  const [pageRows, templateRows, flowRows, blockRows] = await Promise.all([
    db
      .select({ id: pages.id, name: pages.name })
      .from(pages)
      .where(
        and(
          eq(pages.projectId, projectId),
          or(
            sql`${pages.tree}::text like ${like}`,
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
            sql`${templates.publishedSnapshot}::text like ${like}`
          )
        )
      ),
    db
      .select({ id: actionFlows.id })
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
    ...pageRows.map((r): IconUsage => ({ kind: "page", id: r.id, name: r.name })),
    ...templateRows.map((r): IconUsage => ({ kind: "template", id: r.id, name: r.name })),
    ...flowRows.map((r): IconUsage => ({ kind: "action", id: r.id, name: "Action flow" })),
    ...blockRows.map((r): IconUsage => ({ kind: "action", id: r.id, name: "Action block" }))
  ];
}
