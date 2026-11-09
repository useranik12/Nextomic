import { GLOBAL_FUNCTIONS, NAMESPACES, runExpression } from "./evaluate";
import { parseExpression, type Node } from "./parse";
import { splitTemplate } from "./template";

// Finds what is wrong with an expression before it reaches a page: syntax errors, names that do
// not exist, variables that were never declared, and errors while running it on preview values.
// An expression with a problem gives empty text on the page, so the editor marks it.

const GROUP_LABELS: Record<string, string> = {
  app: "app state variable",
  const: "constant",
  state: "page state variable",
  param: "page parameter"
};

function unknownName(
  node: Node,
  scope: Readonly<Record<string, unknown>>,
  bound: ReadonlySet<string>
): string | null {
  const visit = (n: Node, names: ReadonlySet<string>): string | null =>
    unknownName(n, scope, names);
  switch (node.t) {
    case "lit":
      return null;
    case "id":
      if (
        bound.has(node.name) ||
        Object.hasOwn(scope, node.name) ||
        Object.hasOwn(NAMESPACES, node.name)
      )
        return null;
      if (node.name.startsWith("%"))
        return `No query loop named "${node.name.slice(1)}" around this element.`;
      return GLOBAL_FUNCTIONS.some((f) => f.name === node.name)
        ? null
        : `Unknown name "${node.name}".`;
    case "member": {
      if (
        node.obj.t === "id" &&
        !bound.has(node.obj.name) &&
        typeof node.prop === "string" &&
        GROUP_LABELS[node.obj.name]
      ) {
        const group = scope[node.obj.name];
        const known =
          group !== null && typeof group === "object" && Object.hasOwn(group, node.prop);
        if (!known) return `Unknown ${GROUP_LABELS[node.obj.name]} "${node.prop}".`;
      }
      return (
        visit(node.obj, bound) ?? (typeof node.prop === "string" ? null : visit(node.prop, bound))
      );
    }
    case "call":
      return visit(node.callee, bound) ?? firstOf(node.args, (a) => visit(a, bound));
    case "unary":
      return visit(node.arg, bound);
    case "bin":
      return visit(node.l, bound) ?? visit(node.r, bound);
    case "cond":
      return visit(node.test, bound) ?? visit(node.yes, bound) ?? visit(node.no, bound);
    case "arr":
      return firstOf(node.items, (a) => visit(a, bound));
    case "obj":
      return firstOf(node.props, (p) => visit(p.value, bound));
    case "arrow":
      return visit(node.body, new Set([...bound, ...node.params]));
    case "tpl":
      return firstOf(node.parts, (p) => (typeof p === "string" ? null : visit(p, bound)));
  }
}

function firstOf<T>(items: readonly T[], check: (item: T) => string | null): string | null {
  for (const item of items) {
    const problem = check(item);
    if (problem) return problem;
  }
  return null;
}

/** Why an expression would not work with these values, or null when it is fine. */
export function expressionProblem(
  source: string,
  scope: Readonly<Record<string, unknown>>
): string | null {
  let tree: Node;
  try {
    tree = parseExpression(source);
  } catch (error) {
    return error instanceof Error ? error.message : "The expression could not be read.";
  }
  const unknown = unknownName(tree, scope, new Set());
  if (unknown) return unknown;
  try {
    runExpression(source, scope);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "The expression failed.";
  }
}

const ELEMENT_TAG = /^\s*attr\s*@/;

/**
 * The first problem among the {{ }} expressions anywhere in `value` (any JSON): text with tags and
 * token parts of mixed values. Keys in `skip` are not searched (for example an element's children).
 */
export function firstExpressionProblem(
  value: unknown,
  scope: Readonly<Record<string, unknown>>,
  skip: ReadonlySet<string> = new Set()
): string | null {
  const check = (expr: string) => (ELEMENT_TAG.test(expr) ? null : expressionProblem(expr, scope));
  if (typeof value === "string") {
    if (!value.includes("{{")) return null;
    return firstOf(splitTemplate(value), (part) =>
      typeof part === "string" ? null : check(part.expr)
    );
  }
  if (Array.isArray(value)) return firstOf(value, (item) => firstExpressionProblem(item, scope));
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.token === "string" && record.token.trim()) {
      const problem = check(record.token.trim());
      if (problem) return problem;
    }
    return firstOf(Object.entries(record), ([key, item]) =>
      skip.has(key) || key === "token" ? null : firstExpressionProblem(item, scope)
    );
  }
  return null;
}
