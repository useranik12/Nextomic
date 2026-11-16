import { actionBlocks, actionFlows, getDb, pages, templates } from "@nextomic/db";
import { ICON_LIBRARY_PROPS, iconKeySchema } from "@nextomic/schema";
import { and, eq, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

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
  const checked = iconKeySchema.parse(key);
  const likes = ICON_LIBRARY_PROPS.map((prop) => `%"${prop}": "${checked}"%`);
  // The stored JSON text holds the key under any of the props an icon slot uses.
  const uses = (column: SQLWrapper) =>
    or(...likes.map((like) => sql`${column}::text like ${like}`)) as SQL;
  const db = getDb();
  const [pageRows, templateRows, flowRows, blockRows] = await Promise.all([
    db
      .select({ id: pages.id, name: pages.name })
      .from(pages)
      .where(
        and(eq(pages.projectId, projectId), or(uses(pages.tree), uses(pages.publishedSnapshot)))
      ),
    db
      .select({ id: templates.id, name: templates.name })
      .from(templates)
      .where(
        and(
          eq(templates.projectId, projectId),
          or(uses(templates.tree), uses(templates.publishedSnapshot))
        )
      ),
    db
      .select({ id: actionFlows.id })
      .from(actionFlows)
      .where(and(eq(actionFlows.projectId, projectId), uses(actionFlows.flows))),
    db
      .select({ id: actionBlocks.id })
      .from(actionBlocks)
      .where(and(eq(actionBlocks.projectId, projectId), uses(actionBlocks.block)))
  ]);
  return [
    ...pageRows.map((r): IconUsage => ({ kind: "page", id: r.id, name: r.name })),
    ...templateRows.map((r): IconUsage => ({ kind: "template", id: r.id, name: r.name })),
    ...flowRows.map((r): IconUsage => ({ kind: "action", id: r.id, name: "Action flow" })),
    ...blockRows.map((r): IconUsage => ({ kind: "action", id: r.id, name: "Action block" }))
  ];
}
