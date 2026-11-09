import { elementNodeSchema, type ElementNode } from "./element";
import { lexExpression, type ExpressionToken } from "./expression/parse";
import { mapExpressions } from "./state-usage";
import { canHaveQuery, freeLoopName, LOOP_NAME_BASES } from "./query";

// Loop names (owner decision 2026-11-09): every query loop has a name, unique on its page, and
// expressions read it as `%name.item` / `%name.index`. Pages saved before names used `item`,
// `index` and `parent.item`; `upgradeLoopTree` names their loops and rewrites those tags once,
// when the tree is read, so the editor, preview and live site all see the new form.

/** The loop names used in a tree, except the one on `exceptId`. */
export function loopNames(root: ElementNode, exceptId?: string): string[] {
  const names: string[] = [];
  const visit = (node: ElementNode) => {
    if (node.id !== exceptId && node.query?.name) names.push(node.query.name);
    node.children.forEach(visit);
  };
  visit(root);
  return names;
}

/**
 * A copy of `value` with every `%from` loop reference renamed to `%to`, and whether anything
 * changed. Only text inside {{ }} changes; `a %from` after a value is modulo and is kept.
 */
export function renameLoopTag<T>(
  value: T,
  from: string,
  to: string
): { value: T; changed: boolean } {
  return mapExpressions(value, (expr) => {
    let tokens: readonly ExpressionToken[];
    try {
      tokens = lexExpression(expr);
    } catch {
      return expr;
    }
    let out = expr;
    for (const tok of [...tokens].reverse())
      if (tok.k === "id" && tok.v === `%${from}`)
        out = out.slice(0, tok.at) + `%${to}` + out.slice(tok.at + tok.v.length);
    return out;
  });
}

/** Names bound by arrow functions in an expression (`item => ...`, `(a, item) => ...`). */
function arrowParams(tokens: readonly ExpressionToken[]): Set<string> {
  const params = new Set<string>();
  tokens.forEach((tok, at) => {
    if (tok.k !== "p" || tok.v !== "=>") return;
    const before = tokens[at - 1];
    if (before?.k === "id") params.add(before.v);
    else if (before?.k === "p" && before.v === ")")
      for (let j = at - 2; j >= 0; j--) {
        const t = tokens[j];
        if (!t || (t.k === "p" && t.v === "(")) break;
        if (t.k === "id") params.add(t.v);
      }
  });
  return params;
}

const isDot = (tok: ExpressionToken | undefined) =>
  tok?.k === "p" && (tok.v === "." || tok.v === "?.");
const isName = (tok: ExpressionToken | undefined, ...names: string[]) =>
  tok?.k === "id" && names.includes(tok.v);

/**
 * An expression with the old loop tags rewritten: `item` and `index` read the innermost loop,
 * `parent.item` the next one out, and so on. `names` are the enclosing loop names, innermost
 * first. Names bound by arrow functions, fields after a dot and text in quotes are left alone.
 */
export function upgradeLoopExpression(expr: string, names: readonly string[]): string {
  if (names.length === 0) return expr;
  let tokens: readonly ExpressionToken[];
  try {
    tokens = lexExpression(expr);
  } catch {
    return expr;
  }
  const bound = arrowParams(tokens);
  const edits: { start: number; end: number; text: string }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok?.k !== "id" || bound.has(tok.v) || isDot(tokens[i - 1])) continue;
    if (!isName(tok, "item", "index", "parent")) continue;
    let depth = 0;
    let j = i;
    while (isName(tokens[j], "parent") && isDot(tokens[j + 1])) {
      depth++;
      j += 2;
    }
    const last = tokens[j];
    const name = names[depth];
    if (last?.k !== "id" || !isName(last, "item", "index") || !name) continue;
    edits.push({ start: tok.at, end: last.at + last.v.length, text: `%${name}.${last.v}` });
    i = j;
  }
  let out = expr;
  for (const edit of edits.reverse())
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

/** True when a node's query has no name (a page saved before loop names). */
const unnamed = (node: ElementNode) => canHaveQuery(node.type) && !!node.query && !node.query.name;

function anyUnnamed(node: ElementNode): boolean {
  return unnamed(node) || node.children.some(anyUnnamed);
}

/**
 * Gives every unnamed loop a free name and rewrites the old loop tags (`item`, `index`,
 * `parent.item`) of its descendants to `%name.…`. Trees whose loops all have names are returned
 * as they are, so this runs once per old page.
 */
export function upgradeLoopTree(root: ElementNode): ElementNode {
  if (!anyUnnamed(root)) return root;
  const taken = loopNames(root);
  const visit = (node: ElementNode, names: readonly string[]): ElementNode => {
    const { children, ...own } = node;
    const upgraded = mapExpressions(own, (expr) => upgradeLoopExpression(expr, names)).value;
    let query = upgraded.query;
    if (query && unnamed(node)) {
      const name = freeLoopName(LOOP_NAME_BASES[query.source], taken);
      taken.push(name);
      query = { ...query, name };
    }
    const inner = query?.enabled && query.name ? [query.name, ...names] : names;
    return { ...upgraded, query, children: children.map((child) => visit(child, inner)) };
  };
  return visit(root, []);
}

/**
 * The tree with each repeated loop name (a duplicated or pasted loop) replaced by a free one, the
 * copy's own `%name` tags renamed with it. The first loop in tree order keeps the name. Returns
 * the same tree when every name is already unique.
 */
export function uniqueLoopNames(root: ElementNode): ElementNode {
  const names = loopNames(root);
  if (new Set(names).size === names.length) return root;
  const taken = [...names];
  const seen = new Set<string>();
  const visit = (node: ElementNode): ElementNode => {
    let next = node;
    const name = node.query?.name;
    if (name && node.query) {
      if (seen.has(name)) {
        const fresh = freeLoopName(name, taken);
        taken.push(fresh);
        seen.add(fresh);
        next = {
          ...node,
          query: { ...node.query, name: fresh },
          children: renameLoopTag(node.children, name, fresh).value
        };
      } else seen.add(name);
    }
    return { ...next, children: next.children.map(visit) };
  };
  return visit(root);
}

/** An element tree as stored on a page or template: parsed, with old loops upgraded. */
export const pageTreeSchema = elementNodeSchema.transform(upgradeLoopTree);
