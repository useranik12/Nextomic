import type { ElementNode } from "./element";
import { walkElements } from "./element";
import type { StyleMap } from "./style";
import { renameVariableRef, VARIABLE_PREFIX } from "./variables";

// Finding and rewriting `var(--nxt-name)` references in styles, so variable usage counts and
// renames reach every style value, raw CSS and element custom CSS.

const ANY_REF = new RegExp(String.raw`var\(\s*${VARIABLE_PREFIX}([a-z][a-z0-9-]*)(?=[\s,)])`, "g");

function eachStyleText(styles: StyleMap, visit: (text: string) => string): StyleMap {
  const out: StyleMap = { breakpoints: {} };
  for (const [bp, byState] of Object.entries(styles.breakpoints)) {
    const states: StyleMap["breakpoints"][string] = {};
    for (const [state, declarations] of Object.entries(byState)) {
      states[state as keyof typeof states] = Object.fromEntries(
        Object.entries(declarations).map(([property, value]) => [property, visit(value)])
      );
    }
    out.breakpoints[bp] = states;
  }
  if (styles.raw !== undefined) out.raw = visit(styles.raw);
  return out;
}

/** Adds, per variable name, how many references the styles hold. */
export function countRefsInStyles(styles: StyleMap, counts: Record<string, number>): void {
  eachStyleText(styles, (text) => {
    for (const m of text.matchAll(ANY_REF)) {
      const name = m[1];
      if (name) counts[name] = (counts[name] ?? 0) + 1;
    }
    return text;
  });
}

export function countVariableUsageInTree(
  root: ElementNode,
  counts: Record<string, number> = {}
): Record<string, number> {
  walkElements(root, (node) => {
    countRefsInStyles(node.styles, counts);
    if (node.customCss) countRefsInStyles({ breakpoints: {}, raw: node.customCss }, counts);
  });
  return counts;
}

export function renameRefsInStyles(styles: StyleMap, from: string, to: string): StyleMap {
  return eachStyleText(styles, (text) => renameVariableRef(text, from, to));
}

/** Rewrites references on every element. Returns true when anything changed. */
export function renameVariableInTree(root: ElementNode, from: string, to: string): boolean {
  let changed = false;
  walkElements(root, (node) => {
    const next = renameRefsInStyles(node.styles, from, to);
    if (JSON.stringify(next) !== JSON.stringify(node.styles)) {
      node.styles = next;
      changed = true;
    }
    if (node.customCss) {
      const css = renameVariableRef(node.customCss, from, to);
      if (css !== node.customCss) {
        node.customCss = css;
        changed = true;
      }
    }
  });
  return changed;
}

// Framework variables (`--primary`) are written without the `--nxt-` prefix, so they have their own
// rewrite, used when colors are renamed or the color prefix changes.

const CSS_VAR_REF = /(var\(\s*--)([A-Za-z][\w-]*)(?![\w-])/g;

/** Points `var(--from)` at `var(--to)` for every pair, in one pass so swapped names stay correct. */
export function renameCssVarRefs(text: string, renames: ReadonlyMap<string, string>): string {
  return text.replace(CSS_VAR_REF, (whole, head: string, name: string) => {
    const to = renames.get(name);
    return to === undefined ? whole : `${head}${to}`;
  });
}

export function renameCssVarsInStyles(
  styles: StyleMap,
  renames: ReadonlyMap<string, string>
): StyleMap {
  return eachStyleText(styles, (text) => renameCssVarRefs(text, renames));
}

/** Rewrites `var(--name)` references on every element. Returns true when anything changed. */
export function renameCssVarsInTree(
  root: ElementNode,
  renames: ReadonlyMap<string, string>
): boolean {
  let changed = false;
  walkElements(root, (node) => {
    const next = renameCssVarsInStyles(node.styles, renames);
    if (JSON.stringify(next) !== JSON.stringify(node.styles)) {
      node.styles = next;
      changed = true;
    }
    if (node.customCss) {
      const css = renameCssVarRefs(node.customCss, renames);
      if (css !== node.customCss) {
        node.customCss = css;
        changed = true;
      }
    }
  });
  return changed;
}
