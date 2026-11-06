import type { ProjectSettings } from "@nextomic/schema";

export type ClassMeta = ProjectSettings["classMeta"];

export interface ClassRow {
  name: string;
  used: number;
  /** User category, or null for Uncategorized. */
  category: string | null;
  locked: boolean;
  hasStyles: boolean;
  source: "project" | "framework";
}

export type ClassSort = "name" | "name-desc" | "used";
export type ClassFilter = "all" | "used" | "unused" | "locked" | "empty";

export const UNCATEGORIZED = "__uncategorized";
export const FRAMEWORK_CATEGORY = "__framework";

/** Every class the project knows: with styles, on elements of this page, or on other saved pages. */
export function buildClassRows(input: {
  classes: ProjectSettings["classes"];
  meta: ClassMeta;
  local: Record<string, number>;
  others: Record<string, number>;
  framework: readonly string[];
}): ClassRow[] {
  const names = new Set([
    ...Object.keys(input.classes),
    ...Object.keys(input.local),
    ...Object.keys(input.others)
  ]);
  const project = [...names].map<ClassRow>((name) => {
    const styles = input.classes[name];
    return {
      name,
      used: (input.local[name] ?? 0) + (input.others[name] ?? 0),
      category: input.meta[name]?.category ?? null,
      locked: input.meta[name]?.locked === true,
      hasStyles: styles !== undefined && Object.keys(styles.breakpoints).length > 0,
      source: "project"
    };
  });
  const fromFramework = input.framework
    .filter((name) => !names.has(name))
    .map<ClassRow>((name) => ({
      name,
      used: (input.local[name] ?? 0) + (input.others[name] ?? 0),
      category: null,
      locked: true,
      hasStyles: true,
      source: "framework"
    }));
  return [...project, ...fromFramework];
}

export interface ClassCategory {
  id: string;
  name: string;
  count: number;
  editable: boolean;
}

export function classCategories(
  rows: readonly ClassRow[],
  extra: readonly string[]
): ClassCategory[] {
  const project = rows.filter((r) => r.source === "project");
  const user = new Set<string>(extra);
  for (const r of project) if (r.category) user.add(r.category);
  const out: ClassCategory[] = [
    {
      id: UNCATEGORIZED,
      name: "Uncategorized",
      count: project.filter((r) => r.category === null).length,
      editable: false
    },
    ...[...user]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        id: name,
        name,
        count: project.filter((r) => r.category === name).length,
        editable: true
      }))
  ];
  const framework = rows.filter((r) => r.source === "framework").length;
  if (framework > 0)
    out.push({ id: FRAMEWORK_CATEGORY, name: "Framework", count: framework, editable: false });
  return out;
}

export interface ClassQuery {
  include: string;
  exclude: string;
  sort: ClassSort;
  filter: ClassFilter;
  /** A category id, or null for all project classes. */
  category: string | null;
}

export function filterClassRows(rows: readonly ClassRow[], q: ClassQuery): ClassRow[] {
  const inc = q.include.trim().toLowerCase();
  const exc = q.exclude.trim().toLowerCase();
  const list = rows.filter((r) => {
    if (q.category === FRAMEWORK_CATEGORY) {
      if (r.source !== "framework") return false;
    } else if (r.source === "framework") {
      // Framework classes join "All" only while searching, so the plain list stays the project's own.
      if (q.category !== null || inc === "") return false;
    } else if (q.category === UNCATEGORIZED) {
      if (r.category !== null) return false;
    } else if (q.category !== null && r.category !== q.category) return false;
    const name = r.name.toLowerCase();
    if (inc && !name.includes(inc)) return false;
    if (exc && name.includes(exc)) return false;
    switch (q.filter) {
      case "used":
        return r.used > 0;
      case "unused":
        return r.used === 0;
      case "locked":
        return r.locked;
      case "empty":
        return !r.hasStyles;
      default:
        return true;
    }
  });
  const by: Record<ClassSort, (a: ClassRow, b: ClassRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    "name-desc": (a, b) => b.name.localeCompare(a.name),
    used: (a, b) => b.used - a.used || a.name.localeCompare(b.name)
  };
  return [...list].sort(by[q.sort]);
}

/** The meta of a class after a change, dropping entries that say nothing. */
export function withClassMeta(
  meta: ClassMeta,
  name: string,
  patch: { category?: string | null; locked?: boolean }
): ClassMeta {
  const current = meta[name] ?? {};
  const category = patch.category === undefined ? current.category : (patch.category ?? undefined);
  const locked = patch.locked === undefined ? current.locked : patch.locked || undefined;
  const { [name]: _old, ...rest } = meta;
  if (category === undefined && locked === undefined) return rest;
  return {
    ...rest,
    [name]: {
      ...(category !== undefined ? { category } : {}),
      ...(locked !== undefined ? { locked } : {})
    }
  };
}

/** The meta after a class is renamed (`to` null: deleted). */
export function moveClassMeta(meta: ClassMeta, from: string, to: string | null): ClassMeta {
  const { [from]: entry, ...rest } = meta;
  return entry && to ? { ...rest, [to]: entry } : rest;
}
