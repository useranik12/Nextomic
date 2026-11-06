import {
  VARIABLE_PREFIX,
  frameworkVariableMeta,
  isBaseColor,
  looksLikeColor,
  resolvedVariables,
  scaleKind,
  type Framework,
  type ProjectVariable,
  type VariableType
} from "@nextomic/schema";

// The Variables manager lists the project's own variables (`--nxt-*`, fully editable) and the
// variables of the current theme's framework (`--primary`, `--text-m`). Colors and scale steps of
// the framework are edited in the Colors, Typography and Spacing tabs, so they show read-only here.

export type VarBadge = "COLORS" | "SCALE";

export interface VarRow {
  key: string;
  source: "project" | "framework";
  /** Name without the leading `--` or `--nxt-`. */
  name: string;
  /** The custom property as written in CSS. */
  cssName: string;
  value: string;
  dark?: string;
  type: VariableType;
  category: string;
  badge?: VarBadge;
  /** Edited elsewhere (a scale step or a derived shade), so not editable in the list. */
  readOnly: boolean;
  /** Where to edit a read-only row. */
  editIn?: "colors" | "typography" | "spacing";
}

export interface VarCategory {
  name: string;
  count: number;
  badge?: VarBadge;
  source: "project" | "framework";
}

const KIND_CATEGORY = { text: "Typography", space: "Spacing", radius: "Radius" } as const;
const KIND_TAB = { text: "typography", space: "spacing", radius: "spacing" } as const;

/** A variable type for a value typed into the new variable row. */
export function guessVariableType(value: string): VariableType {
  const v = value.trim();
  if (looksLikeColor(v)) return "color";
  if (/^-?[\d.]+(px|rem|em|vw|vh|%)$/.test(v) || /^(clamp|calc|min|max)\(/.test(v)) return "size";
  if (/^-?[\d.]+$/.test(v)) return "number";
  if (/\d+px\s+\S+/.test(v) && /(rgba?|hsla?|#)/i.test(v)) return "shadow";
  return "string";
}

export function buildRows(
  project: readonly ProjectVariable[],
  framework: Framework | null
): VarRow[] {
  const rows: VarRow[] = project.map((v) => ({
    key: `p:${v.name}`,
    source: "project",
    name: v.name,
    cssName: `${VARIABLE_PREFIX}${v.name}`,
    value: v.value,
    type: v.type,
    category: v.group,
    readOnly: false
  }));
  if (!framework) return rows;
  const stored = new Set(framework.variables.map((v) => v.name));
  const scaleOf = new Map<string, keyof typeof KIND_CATEGORY>();
  for (const s of framework.scales)
    for (const n of s.names) scaleOf.set(`${s.prefix}-${n}`, scaleKind(s));
  const colorGroupOf = new Map<string, string>();
  for (const v of framework.variables)
    if (isBaseColor(v, framework.variables)) colorGroupOf.set(v.name, v.group ?? "Colors");
  for (const v of resolvedVariables(framework)) {
    const meta = frameworkVariableMeta(v);
    const scale = scaleOf.get(v.name);
    const base = [...colorGroupOf.keys()].find(
      (c) => v.name.startsWith(`${c}-`) && !stored.has(v.name)
    );
    const color = colorGroupOf.get(v.name) ?? (base ? colorGroupOf.get(base) : undefined);
    const common = {
      key: `f:${v.name}`,
      source: "framework" as const,
      name: v.name,
      cssName: meta.cssName,
      value: v.value,
      ...(v.dark !== undefined ? { dark: v.dark } : {})
    };
    if (scale)
      rows.push({
        ...common,
        type: "fluid-size",
        category: KIND_CATEGORY[scale],
        badge: "SCALE",
        readOnly: true,
        editIn: KIND_TAB[scale]
      });
    else if (color)
      rows.push({
        ...common,
        type: "color",
        category: color,
        badge: "COLORS",
        readOnly: !stored.has(v.name) || colorGroupOf.get(v.name) === undefined,
        editIn: "colors"
      });
    else
      rows.push({
        ...common,
        type:
          meta.type === "size"
            ? "size"
            : meta.type === "shadow"
              ? "shadow"
              : meta.type === "color"
                ? "color"
                : "string",
        category: "Framework",
        readOnly: !stored.has(v.name)
      });
  }
  return rows;
}

export function buildCategories(rows: readonly VarRow[], extra: readonly string[]): VarCategory[] {
  const out = new Map<string, VarCategory>();
  for (const r of rows) {
    const id = `${r.source}:${r.category}`;
    const cur = out.get(id);
    if (cur) cur.count += 1;
    else
      out.set(id, {
        name: r.category,
        count: 1,
        source: r.source,
        ...(r.badge ? { badge: r.badge } : {})
      });
  }
  for (const name of extra)
    if (!out.has(`project:${name}`))
      out.set(`project:${name}`, { name, count: 0, source: "project" });
  const all = [...out.values()];
  const project = all
    .filter((c) => c.source === "project")
    .sort((a, b) => a.name.localeCompare(b.name));
  const framework = all.filter((c) => c.source === "framework");
  return [...project, ...framework];
}

export type VarSort = "name" | "name-desc" | "value" | "type" | "used";
export type VarFilter = "all" | "unused" | VariableType;

export interface VarQuery {
  include: string;
  exclude: string;
  sort: VarSort;
  filter: VarFilter;
  /** `source:name` of the selected category, or null for all. */
  category: string | null;
}

export function filterRows(
  rows: readonly VarRow[],
  q: VarQuery,
  usage: Record<string, number>
): VarRow[] {
  const inc = q.include.trim().toLowerCase();
  const exc = q.exclude.trim().toLowerCase();
  const text = (r: VarRow): string => `${r.name} ${r.value}`.toLowerCase();
  const list = rows.filter((r) => {
    if (q.category && `${r.source}:${r.category}` !== q.category) return false;
    if (inc && !text(r).includes(inc)) return false;
    if (exc && text(r).includes(exc)) return false;
    if (q.filter === "unused") return r.source === "project" && (usage[r.name] ?? 0) === 0;
    return q.filter === "all" || r.type === q.filter;
  });
  const by: Record<VarSort, (a: VarRow, b: VarRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    "name-desc": (a, b) => b.name.localeCompare(a.name),
    value: (a, b) => a.value.localeCompare(b.value),
    type: (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
    used: (a, b) => (usage[b.name] ?? 0) - (usage[a.name] ?? 0) || a.name.localeCompare(b.name)
  };
  return [...list].sort(by[q.sort]);
}
