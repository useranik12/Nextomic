import { runExpression } from "./expression/evaluate";
import { splitTemplate } from "./expression/template";
import { readJsonPath } from "./json-path";
import type { LocalLoopKind, LocalLoopQuery } from "./query";
import type { QueryRows } from "./query-run";
import { loopScopeKey } from "./query-scope";

// Rows of an "Other Loops" loop (owner decision 2026-11-09): read from the expression scope the
// loop runs in (page parameters, page state, app state, constants, enclosing loop rows), from
// static JSON, or from an expression. Pure and synchronous; the server render, the loop endpoint
// and the editor canvas all use it, with no request. A value that is not a list gives no rows.

/** Most items one local loop repeats (like the expression engine's list cap). */
const MAX_ITEMS = 10_000;

const GROUPS: Partial<Record<LocalLoopKind, string>> = {
  param: "param",
  state: "state",
  app: "app",
  const: "const"
};

function own(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" && Object.hasOwn(value, key)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/** The value a local loop repeats over, before it is turned into a list. */
export function localLoopValue(query: LocalLoopQuery, scope: Readonly<Record<string, unknown>>) {
  const group = GROUPS[query.kind];
  if (group) return own(own(scope, group), query.variable);
  switch (query.kind) {
    case "parent": {
      const row = own(own(scope, loopScopeKey(query.parentLoop)), "item");
      return query.field.trim() ? readJsonPath(row, `$.${query.field.trim()}`) : undefined;
    }
    case "json":
      try {
        return JSON.parse(query.json) as unknown;
      } catch {
        return undefined;
      }
    case "expression": {
      // One {{ tag }} gives its value as is (a list stays a list); anything else is text.
      const parts = splitTemplate(query.expression.trim());
      const only = parts.length === 1 ? parts[0] : undefined;
      if (!only || typeof only === "string") return query.expression;
      try {
        return runExpression(only.expr, scope);
      } catch {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

/**
 * A value as a list: lists as they are; text holding a JSON array is parsed; page parameters may
 * also be comma-separated text (`?tags=a,b`). Anything else is an empty list.
 */
export function asLoopList(value: unknown, kind: LocalLoopKind): unknown[] {
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS);
  if (typeof value !== "string" || !value.trim()) return [];
  const text = value.trim();
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
    } catch {
      return [];
    }
  }
  if (kind === "param")
    return text
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, MAX_ITEMS);
  return [];
}

/** The rows of a local loop from `offset` (its own offset is added first). */
export function localLoopRows(
  query: LocalLoopQuery,
  scope: Readonly<Record<string, unknown>>,
  offset = 0
): QueryRows {
  const all = asLoopList(localLoopValue(query, scope), query.kind).slice(query.offset);
  if (query.single) return { rows: all.slice(0, 1), hasMore: false };
  const rows = all.slice(offset, offset + query.limit);
  return { rows, hasMore: offset + query.limit < all.length };
}
