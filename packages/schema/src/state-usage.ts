import { splitTemplate } from "./expression/template";

// Where app state variables and constants are used: any app.name / const.name inside a {{ }}
// expression in a page or template (tree, settings, SEO), written either inside text or as a token
// part of a mixed value. Works on plain JSON so it covers every place a tag can be written.

export type StateGroup = "app" | "const";

const NAME = "[A-Za-z_][A-Za-z0-9_]*";
// A variable reference inside an expression, not the end of a longer name or path (`x.app.a`).
const IN_EXPR = new RegExp(`(?<![\\w$.%])(app|const)\\.(${NAME})`, "g");

export type StateUsageCounts = Record<StateGroup, Record<string, number>>;

export const emptyStateUsage = (): StateUsageCounts => ({ app: {}, const: {} });

function add(counts: StateUsageCounts, group: string, name: string) {
  const bucket = counts[group as StateGroup];
  bucket[name] = (bucket[name] ?? 0) + 1;
}

function isTokenPart(value: object): value is { token: string } {
  return "token" in value && typeof (value as { token: unknown }).token === "string";
}

function countIn(expr: string, counts: StateUsageCounts) {
  for (const match of expr.matchAll(IN_EXPR)) add(counts, match[1] as string, match[2] as string);
}

/** Adds every app and const reference found in `value` (any JSON) to `counts`. */
export function countStateUsage(value: unknown, counts: StateUsageCounts): StateUsageCounts {
  if (typeof value === "string") {
    for (const part of splitTemplate(value))
      if (typeof part !== "string") countIn(part.expr, counts);
  } else if (Array.isArray(value)) {
    for (const item of value) countStateUsage(item, counts);
  } else if (value !== null && typeof value === "object") {
    if (isTokenPart(value)) countIn(value.token, counts);
    for (const [key, item] of Object.entries(value))
      if (key !== "token") countStateUsage(item, counts);
  }
  return counts;
}

/**
 * A copy of `value` with every `group.from` reference pointed at `group.to` (dotted paths after
 * the name are kept), and whether anything changed. Only text inside {{ }} is changed.
 */
export function renameStateTag<T>(
  value: T,
  group: StateGroup,
  from: string,
  to: string
): { value: T; changed: boolean } {
  const inExpr = new RegExp(`(?<![\\w$.%])(${group}\\.)${from}(?![A-Za-z0-9_])`, "g");
  return mapExpressions(value, (expr) => expr.replace(inExpr, `$1${to}`));
}

/**
 * A copy of `value` (any JSON) with every {{ }} expression passed through `rewrite`, and whether
 * anything changed. Text gets each expression without its braces; a mixed value's `token` part is
 * passed whole. Text outside {{ }} is never changed.
 */
export function mapExpressions<T>(
  value: T,
  rewrite: (expr: string) => string
): { value: T; changed: boolean } {
  let changed = false;
  const renameText = (text: string) => {
    let out = "";
    let at = 0;
    for (const part of splitTemplate(text)) {
      if (typeof part === "string") continue;
      const inner = text.slice(part.start + 2, part.end - 2);
      out += text.slice(at, part.start) + "{{" + rewrite(inner) + "}}";
      at = part.end;
    }
    return out + text.slice(at);
  };
  const walk = (node: unknown, key?: string): unknown => {
    if (typeof node === "string") {
      const next = key === "token" ? rewrite(node) : renameText(node);
      if (next !== node) changed = true;
      return next;
    }
    if (Array.isArray(node)) return node.map((item) => walk(item));
    if (node !== null && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v, k);
      return out;
    }
    return node;
  };
  const next = walk(value) as T;
  return { value: changed ? next : value, changed };
}
