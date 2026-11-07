import {
  countStateUsage,
  emptyStateUsage,
  renameStateTag,
  type StateGroup,
  type StateUsageCounts
} from "@nextomic/schema";
import { getDb, pages, templates } from "@nextomic/db";
import { and, eq, sql } from "drizzle-orm";

// Where app state variables and constants are used across the saved pages and templates of a
// project. Callers MUST have passed requireProjectAccess first; every query is scoped by projectId.

export interface StateUsageItem {
  kind: "page" | "template";
  id: string;
  name: string;
  counts: StateUsageCounts;
}

/** Every saved page and template that uses at least one app or const tag, with its counts. */
export async function stateUsageByItem(projectId: string): Promise<StateUsageItem[]> {
  const db = getDb();
  const [pageRows, templateRows] = await Promise.all([
    db
      .select({ id: pages.id, name: pages.name, tree: pages.tree, settings: pages.settings })
      .from(pages)
      .where(eq(pages.projectId, projectId)),
    db
      .select({
        id: templates.id,
        name: templates.name,
        tree: templates.tree,
        settings: templates.settings
      })
      .from(templates)
      .where(eq(templates.projectId, projectId))
  ]);
  const items: StateUsageItem[] = [];
  const collect = (
    kind: StateUsageItem["kind"],
    row: { id: string; name: string; tree: unknown; settings: unknown }
  ) => {
    const counts = countStateUsage([row.tree, row.settings], emptyStateUsage());
    if (Object.keys(counts.app).length + Object.keys(counts.const).length > 0)
      items.push({ kind, id: row.id, name: row.name, counts });
  };
  for (const row of pageRows) collect("page", row);
  for (const row of templateRows) collect("template", row);
  return items;
}

/**
 * Points `group.from` tags at `group.to` on every saved page and template except the one open in
 * the editor (`exceptId`), which the editor changes itself. Returns how many items changed.
 */
export async function renameStateTagEverywhere(
  projectId: string,
  exceptId: string,
  group: StateGroup,
  from: string,
  to: string
): Promise<number> {
  return getDb().transaction(async (tx) => {
    let updated = 0;
    const pageRows = await tx
      .select({ id: pages.id, tree: pages.tree, settings: pages.settings })
      .from(pages)
      .where(eq(pages.projectId, projectId));
    for (const row of pageRows) {
      if (row.id === exceptId) continue;
      const tree = renameStateTag(row.tree, group, from, to);
      const settings = renameStateTag(row.settings, group, from, to);
      if (!tree.changed && !settings.changed) continue;
      await tx
        .update(pages)
        .set({
          tree: tree.value,
          settings: settings.value,
          version: sql`${pages.version} + 1`,
          updatedAt: new Date()
        })
        .where(and(eq(pages.id, row.id), eq(pages.projectId, projectId)));
      updated += 1;
    }
    const templateRows = await tx
      .select({ id: templates.id, tree: templates.tree, settings: templates.settings })
      .from(templates)
      .where(eq(templates.projectId, projectId));
    for (const row of templateRows) {
      if (row.id === exceptId) continue;
      const tree = renameStateTag(row.tree, group, from, to);
      const settings = renameStateTag(row.settings, group, from, to);
      if (!tree.changed && !settings.changed) continue;
      await tx
        .update(templates)
        .set({
          tree: tree.value,
          settings: settings.value,
          version: sql`${templates.version} + 1`,
          updatedAt: new Date()
        })
        .where(and(eq(templates.id, row.id), eq(templates.projectId, projectId)));
      updated += 1;
    }
    return updated;
  });
}
