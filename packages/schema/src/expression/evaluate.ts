import { DateTime } from "luxon";
import { kindOf, MAX_ITEMS, MAX_TEXT, memberOf, type MemberDoc } from "./methods";
import { ExpressionError, parseExpression, type Node } from "./parse";

// Walks a parsed expression. Only plain data and the documented methods are reachable: no globals,
// no prototypes (constructor, __proto__ ...), no host objects. A step budget stops runaway loops,
// and text and list sizes are capped, so a page can never hang the server that renders it.

const BLOCKED = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "__defineGetter__",
  "__lookupGetter__"
]);
const STEP_LIMIT = 50_000;

/** Functions written in an expression; only these (and built-ins below) can be called. */
const closures = new WeakSet<object>();

interface Budget {
  steps: number;
}

type Scope = Readonly<Record<string, unknown>>;

/** A namespace or helper callable from expressions, with docs for the autocomplete. */
interface Builtin extends MemberDoc {
  run: (args: unknown[]) => unknown;
}

const helper = (
  name: string,
  signature: string,
  returns: MemberDoc["returns"],
  description: string,
  example: string,
  run: Builtin["run"]
): Builtin => ({ name, kind: "method", signature, returns, description, example, run });

const isEmpty = (v: unknown) =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (kindOf(v) === "object" && Object.keys(v as object).length === 0);

/** Functions available by name: $if(...), $ifEmpty(...), Number(...) ... */
export const GLOBAL_FUNCTIONS: Builtin[] = [
  helper(
    "$if",
    "(condition, then, else)",
    "any",
    "Picks a value by a condition.",
    '$if(user.id, "Hi", "Sign in")',
    ([c, a, b]) => (c ? a : b)
  ),
  helper(
    "$ifEmpty",
    "(value, fallback)",
    "any",
    "The value, or the fallback when it is empty.",
    '$ifEmpty(user.name, "Guest")',
    ([v, f]) => (isEmpty(v) ? f : v)
  ),
  helper("$min", "(...numbers)", "number", "The smallest number.", "$min(3, 7) → 3", (args) =>
    Math.min(...args.map(Number))
  ),
  helper("$max", "(...numbers)", "number", "The largest number.", "$max(3, 7) → 7", (args) =>
    Math.max(...args.map(Number))
  ),
  helper("Number", "(value)", "number", "The value as a number.", 'Number("4") → 4', ([v]) =>
    Number(v)
  ),
  helper("String", "(value)", "string", "The value as text.", 'String(4) → "4"', ([v]) =>
    toText(v)
  ),
  helper(
    "Boolean",
    "(value)",
    "boolean",
    "The value as true or false.",
    'Boolean("") → false',
    ([v]) => Boolean(v)
  ),
  helper(
    "parseInt",
    "(text)",
    "number",
    "A whole number read from text.",
    'parseInt("42px") → 42',
    ([v]) => parseInt(String(v), 10)
  ),
  helper(
    "parseFloat",
    "(text)",
    "number",
    "A number read from text.",
    'parseFloat("4.5kg") → 4.5',
    ([v]) => parseFloat(String(v))
  )
];

/** Namespaces: Math.round(...), JSON.stringify(...), DateTime.fromISO(...). */
export const NAMESPACES: Record<string, { description: string; members: Builtin[] }> = {
  Math: {
    description: "Math functions.",
    members: (
      [
        "round",
        "floor",
        "ceil",
        "abs",
        "sqrt",
        "pow",
        "min",
        "max",
        "random",
        "trunc",
        "sign"
      ] as const
    ).map((name) =>
      helper(name, "(...)", "number", `Math.${name}`, `Math.${name}(…)`, (args) =>
        (Math[name] as (...a: number[]) => number)(...args.map(Number))
      )
    )
  },
  JSON: {
    description: "Turn values into JSON text and back.",
    members: [
      helper(
        "stringify",
        "(value, spaces?)",
        "string",
        "The value as JSON text.",
        "JSON.stringify(app.cart)",
        ([v, s]) => {
          const out = JSON.stringify(v, null, typeof s === "number" ? Math.min(s, 8) : undefined);
          if (out && out.length > MAX_TEXT) throw new ExpressionError("The text is too long.");
          return out ?? "";
        }
      ),
      helper("parse", "(text)", "any", "Reads JSON text.", 'JSON.parse("[1,2]")', ([v]) => {
        try {
          return JSON.parse(String(v)) as unknown;
        } catch {
          return null;
        }
      })
    ]
  },
  DateTime: {
    description: "Make dates (Luxon).",
    members: [
      helper("now", "()", "date", "The current date and time.", "DateTime.now()", () =>
        DateTime.now()
      ),
      helper(
        "fromISO",
        "(text)",
        "date",
        "A date from ISO text.",
        'DateTime.fromISO("2026-01-31")',
        ([v]) => DateTime.fromISO(String(v), { setZone: true })
      ),
      helper(
        "fromFormat",
        "(text, format)",
        "date",
        "A date from text in a format.",
        'DateTime.fromFormat("31/01/2026", "dd/MM/yyyy")',
        ([v, f]) => DateTime.fromFormat(String(v), String(f))
      ),
      helper(
        "fromMillis",
        "(ms)",
        "date",
        "A date from Unix milliseconds.",
        "DateTime.fromMillis(0)",
        ([v]) => DateTime.fromMillis(Number(v))
      )
    ]
  }
};

/** Text for a value: empty for nothing, ISO for dates, JSON for lists and objects. */
export function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (DateTime.isDateTime(value)) return value.isValid ? (value.toISO() ?? "") : "";
  if (typeof value === "function") return "";
  return JSON.stringify(value);
}

function tick(budget: Budget) {
  if (++budget.steps > STEP_LIMIT)
    throw new ExpressionError("The expression takes too many steps.");
}

function readProperty(obj: unknown, key: unknown): unknown {
  const name = typeof key === "number" ? key : String(key);
  if (typeof name === "string" && BLOCKED.has(name)) return undefined;
  const kind = kindOf(obj);
  if (kind === "null") return undefined;
  if (typeof name === "string") {
    const member = memberOf(kind, name);
    if (member?.kind === "property") return member.run(obj as never, []);
  }
  if (kind === "array") {
    const index = typeof name === "number" ? name : /^\d+$/.test(name) ? Number(name) : NaN;
    return Number.isInteger(index) ? (obj as unknown[])[index] : undefined;
  }
  if (kind === "object" && !closures.has(obj as object)) {
    const key2 = String(name);
    return Object.hasOwn(obj as object, key2) ? (obj as Record<string, unknown>)[key2] : undefined;
  }
  return undefined;
}

function binary(op: string, l: unknown, r: unknown): unknown {
  switch (op) {
    case "+": {
      if (typeof l === "number" && typeof r === "number") return l + r;
      const out = toText(l) + toText(r);
      if (out.length > MAX_TEXT) throw new ExpressionError("The text is too long.");
      return out;
    }
    case "-":
      return Number(l) - Number(r);
    case "*":
      return Number(l) * Number(r);
    case "/":
      return Number(l) / Number(r);
    case "%":
      return Number(l) % Number(r);
    case "===":
      return same(l, r);
    case "!==":
      return !same(l, r);
    case "==":
      // Loose equality on primitives only (no object coercion).
      return (
        same(l, r) ||
        (l != null &&
          r != null &&
          typeof l !== "object" &&
          typeof r !== "object" &&
          String(l) === String(r))
      );
    case "!=":
      return !binary("==", l, r);
    case "<":
      return (l as number) < (r as number);
    case ">":
      return (l as number) > (r as number);
    case "<=":
      return (l as number) <= (r as number);
    case ">=":
      return (l as number) >= (r as number);
    default:
      throw new ExpressionError(`Unknown operator "${op}".`);
  }
}

/** Equality that compares dates by moment. */
function same(l: unknown, r: unknown): boolean {
  if (DateTime.isDateTime(l) && DateTime.isDateTime(r)) return l.toMillis() === r.toMillis();
  return l === r;
}

function evaluate(node: Node, scope: Scope, budget: Budget): unknown {
  tick(budget);
  switch (node.t) {
    case "lit":
      return node.v;
    case "id":
      if (Object.hasOwn(scope, node.name)) return scope[node.name];
      if (Object.hasOwn(NAMESPACES, node.name)) return { __namespace: node.name };
      return undefined;
    case "tpl":
      return node.parts
        .map((part) => (typeof part === "string" ? part : toText(evaluate(part, scope, budget))))
        .join("");
    case "arr":
      return node.items.slice(0, MAX_ITEMS).map((item) => evaluate(item, scope, budget));
    case "obj": {
      const out: Record<string, unknown> = {};
      for (const { key, value } of node.props)
        if (!BLOCKED.has(key)) out[key] = evaluate(value, scope, budget);
      return out;
    }
    case "unary": {
      const v = evaluate(node.arg, scope, budget);
      if (node.op === "!") return !v;
      if (node.op === "-") return -Number(v);
      if (node.op === "+") return Number(v);
      return v === null ? "object" : DateTime.isDateTime(v) ? "object" : typeof v;
    }
    case "bin": {
      if (node.op === "&&")
        return evaluate(node.l, scope, budget) && evaluate(node.r, scope, budget);
      if (node.op === "||")
        return evaluate(node.l, scope, budget) || evaluate(node.r, scope, budget);
      if (node.op === "??")
        return evaluate(node.l, scope, budget) ?? evaluate(node.r, scope, budget);
      return binary(node.op, evaluate(node.l, scope, budget), evaluate(node.r, scope, budget));
    }
    case "cond":
      return evaluate(node.test, scope, budget)
        ? evaluate(node.yes, scope, budget)
        : evaluate(node.no, scope, budget);
    case "member": {
      const obj = evaluate(node.obj, scope, budget);
      const key = typeof node.prop === "string" ? node.prop : evaluate(node.prop, scope, budget);
      return readProperty(obj, key);
    }
    case "arrow": {
      const run = (...args: unknown[]) => {
        const local: Record<string, unknown> = { ...scope };
        node.params.forEach((name, i) => {
          local[name] = args[i];
        });
        return evaluate(node.body, local, budget);
      };
      closures.add(run);
      return run;
    }
    case "call":
      return call(node, scope, budget);
  }
}

function call(node: Extract<Node, { t: "call" }>, scope: Scope, budget: Budget): unknown {
  const args = () => node.args.map((a) => evaluate(a, scope, budget));
  const callee = node.callee;
  if (callee.t === "member" && typeof callee.prop === "string") {
    const self = evaluate(callee.obj, scope, budget);
    if (self === null || self === undefined) {
      if (node.optional || callee.optional) return undefined;
      throw new ExpressionError(`Cannot call .${callee.prop}() on an empty value.`);
    }
    if (typeof self === "object" && "__namespace" in self) {
      const space = NAMESPACES[String((self as { __namespace: string }).__namespace)];
      const fn = space?.members.find((x) => x.name === callee.prop);
      if (!fn)
        throw new ExpressionError(
          `Unknown function ${String((self as { __namespace: string }).__namespace)}.${callee.prop}().`
        );
      return fn.run(args());
    }
    const member = memberOf(kindOf(self), callee.prop);
    if (member?.kind === "method") return member.run(self as never, args());
    throw new ExpressionError(`.${callee.prop}() is not available on ${kindOf(self)} values.`);
  }
  if (callee.t === "id" && !Object.hasOwn(scope, callee.name)) {
    const fn = GLOBAL_FUNCTIONS.find((x) => x.name === callee.name);
    if (!fn) throw new ExpressionError(`Unknown function ${callee.name}().`);
    return fn.run(args());
  }
  const target = evaluate(callee, scope, budget);
  if (typeof target === "function" && closures.has(target))
    return (target as (...a: unknown[]) => unknown)(...args());
  if (target === undefined && node.optional) return undefined;
  throw new ExpressionError("That is not a function.");
}

/** Runs one expression against a scope. Throws ExpressionError when it is invalid or fails. */
export function runExpression(source: string, scope: Scope): unknown {
  return evaluate(parseExpression(source), scope, { steps: 0 });
}
