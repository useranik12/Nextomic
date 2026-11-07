// Where app state variables and constants are used: any {{app.name}} / {{const.name}} tag in a
// page or template (tree, settings, SEO), written either inside text or as a token part of a
// mixed value. Works on plain JSON so it covers every place a tag can be written.

export type StateGroup = "app" | "const";

const NAME = "[A-Za-z_][A-Za-z0-9_]*";
const IN_TEXT = new RegExp(`\\{\\{\\s*(app|const)\\.(${NAME})`, "g");
const TOKEN = new RegExp(`^\\s*(app|const)\\.(${NAME})`);

export type StateUsageCounts = Record<StateGroup, Record<string, number>>;

export const emptyStateUsage = (): StateUsageCounts => ({ app: {}, const: {} });

function add(counts: StateUsageCounts, group: string, name: string) {
  const bucket = counts[group as StateGroup];
  bucket[name] = (bucket[name] ?? 0) + 1;
}

function isTokenPart(value: object): value is { token: string } {
  return "token" in value && typeof (value as { token: unknown }).token === "string";
}

/** Adds every app and const tag found in `value` (any JSON) to `counts`. */
export function countStateUsage(value: unknown, counts: StateUsageCounts): StateUsageCounts {
  if (typeof value === "string") {
    for (const match of value.matchAll(IN_TEXT))
      add(counts, match[1] as string, match[2] as string);
  } else if (Array.isArray(value)) {
    for (const item of value) countStateUsage(item, counts);
  } else if (value !== null && typeof value === "object") {
    if (isTokenPart(value)) {
      const match = TOKEN.exec(value.token);
      if (match) add(counts, match[1] as string, match[2] as string);
    }
    for (const item of Object.values(value)) countStateUsage(item, counts);
  }
  return counts;
}

/**
 * A copy of `value` with every `group.from` tag pointed at `group.to` (dotted paths after the
 * name are kept), and whether anything changed.
 */
export function renameStateTag<T>(
  value: T,
  group: StateGroup,
  from: string,
  to: string
): { value: T; changed: boolean } {
  let changed = false;
  const inText = new RegExp(`(\\{\\{\\s*${group}\\.)${from}(?![A-Za-z0-9_])`, "g");
  const inToken = new RegExp(`^(\\s*${group}\\.)${from}(?![A-Za-z0-9_])`);
  const walk = (node: unknown, key?: string): unknown => {
    if (typeof node === "string") {
      const next =
        key === "token" ? node.replace(inToken, `$1${to}`) : node.replace(inText, `$1${to}`);
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
