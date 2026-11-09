import { parseExpression, type Node } from "./parse";
import type { ValueKind } from "./methods";

// Transforms (dynamic-data-and-actions.md §6): a typed chain of steps added to a tag in the bolt
// modal. A chain is not stored on its own: it compiles to the expression methods the evaluator
// already runs ({{ app.price?.round(2)?.format("en-US", { style: "currency", currency: "USD" }) }}),
// so the page, the server and the canvas evaluate it unchanged and the text stays editable.
// parseTransformChain reads such a tag back into steps so the modal can reopen it.

/** A value kind, or "any" when it is not known (no sample value, or a step like First). */
export type TransformKind = ValueKind | "any";

export type TransformGroup = "Convert" | "Text" | "List" | "Number" | "Date";
export const TRANSFORM_GROUPS: TransformGroup[] = ["Convert", "Text", "List", "Number", "Date"];

export type TransformValue = string | number | boolean;
export type TransformValues = Record<string, TransformValue>;

export interface TransformParam {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Shown only when this returns true for the step's values. */
  when?: (values: TransformValues) => boolean;
}

/** One method call (args) or property read (args null) of the compiled chain. */
interface Call {
  name: string;
  args: unknown[] | null;
}

export interface TransformDef {
  id: string;
  label: string;
  group: TransformGroup;
  accepts: ValueKind[];
  returns: TransformKind;
  params: TransformParam[];
  defaults: TransformValues;
  toCalls: (values: TransformValues, input: TransformKind) => Call[];
  /** Reads the calls starting at `at` back into values; `used` is how many calls it took. */
  match: (calls: Call[], at: number) => { values: TransformValues; used: number } | null;
}

export interface TransformStep {
  id: string;
  values: TransformValues;
}

export interface TransformChain {
  /** The tag the chain starts from, like app.price or %posts.item.createdAt. */
  base: string;
  steps: TransformStep[];
  /** Shown when the result is empty (also when a date cannot be read). Empty = no fallback. */
  fallback: string;
}

const call = (name: string, ...args: unknown[]): Call => ({ name, args });
const prop = (name: string): Call => ({ name, args: null });
const isCall = (c: Call | undefined, name: string, max = 0): c is Call & { args: unknown[] } =>
  !!c && c.name === name && c.args !== null && c.args.length <= max;
const text = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const int = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;

/** A step that is one call with no arguments. */
function plain(
  id: string,
  label: string,
  group: TransformGroup,
  method: string,
  accepts: ValueKind[],
  returns: TransformKind
): TransformDef {
  return {
    id,
    label,
    group,
    accepts,
    returns,
    params: [],
    defaults: {},
    toCalls: () => [call(method)],
    match: (calls, at) => (isCall(calls[at], method) ? { values: {}, used: 1 } : null)
  };
}

const NUMBER_STYLES = [
  { value: "decimal", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent (0.25 → 25%)" }
];

const DATE_PRESETS = [
  { value: "date", label: "Date (Nov 9, 2026)" },
  { value: "time", label: "Time (9:30 AM)" },
  { value: "datetime", label: "Date and time" },
  { value: "relative", label: "Relative (2 hours ago)" },
  { value: "iso", label: "ISO (2026-11-09T09:30:00Z)" },
  { value: "custom", label: "Custom pattern" }
];
/** Date preset → the method it compiles to. ISO takes no locale. */
const PRESET_METHODS: Record<string, string> = {
  date: "toDateString",
  time: "toTimeString",
  datetime: "toLocaleString",
  relative: "toRelative",
  iso: "toISO",
  custom: "toFormat"
};

const numberFormat: TransformDef = {
  id: "numberFormat",
  label: "Format number",
  group: "Number",
  accepts: ["number"],
  returns: "string",
  params: [
    { key: "style", label: "Style", type: "select", options: NUMBER_STYLES },
    {
      key: "currency",
      label: "Currency",
      type: "text",
      placeholder: "USD",
      when: (v) => v.style === "currency"
    },
    { key: "decimals", label: "Decimals (empty = automatic)", type: "text", placeholder: "2" },
    { key: "locale", label: "Language", type: "text", placeholder: "en-US" }
  ],
  defaults: { style: "decimal", currency: "USD", decimals: "", locale: "en-US" },
  toCalls: (v) => {
    const options: Record<string, unknown> = {};
    if (v.style !== "decimal") options.style = v.style;
    if (v.style === "currency") options.currency = text(v.currency, "USD").toUpperCase() || "USD";
    const decimals = String(v.decimals ?? "").trim();
    if (/^\d+$/.test(decimals)) {
      const d = Math.min(Number(decimals), 20);
      options.minimumFractionDigits = d;
      options.maximumFractionDigits = d;
    }
    const locale = text(v.locale).trim() || "en-US";
    return [Object.keys(options).length ? call("format", locale, options) : call("format", locale)];
  },
  match: (calls, at) => {
    const c = calls[at];
    if (!isCall(c, "format", 2)) return null;
    const [locale, options] = c.args;
    if (locale !== undefined && typeof locale !== "string") return null;
    const o = (options ?? {}) as Record<string, unknown>;
    if (typeof o !== "object" || Array.isArray(o)) return null;
    const known = ["style", "currency", "minimumFractionDigits", "maximumFractionDigits"];
    if (Object.keys(o).some((k) => !known.includes(k))) return null;
    const style = text(o.style, "decimal");
    if (!NUMBER_STYLES.some((s) => s.value === style)) return null;
    const digits = o.maximumFractionDigits;
    if (digits !== undefined && digits !== o.minimumFractionDigits) return null;
    return {
      values: {
        style,
        currency: text(o.currency, "USD"),
        decimals: typeof digits === "number" ? String(digits) : "",
        locale: text(locale, "en-US")
      },
      used: 1
    };
  }
};

const dateFormat: TransformDef = {
  id: "dateFormat",
  label: "Format date",
  group: "Date",
  accepts: ["date", "string"],
  returns: "string",
  params: [
    { key: "preset", label: "Format", type: "select", options: DATE_PRESETS },
    {
      key: "pattern",
      label: "Pattern",
      type: "text",
      placeholder: "dd LLL yyyy, HH:mm",
      when: (v) => v.preset === "custom"
    },
    {
      key: "zone",
      label: "Time zone (empty = as stored)",
      type: "text",
      placeholder: "Asia/Kolkata"
    },
    {
      key: "locale",
      label: "Language",
      type: "text",
      placeholder: "en-US",
      when: (v) => v.preset !== "iso"
    }
  ],
  defaults: { preset: "date", pattern: "dd LLL yyyy", zone: "", locale: "en-US" },
  toCalls: (v, input) => {
    const calls: Call[] = [];
    // Text (an ISO or SQL timestamp) is read as a date first; a text that is no date gives empty.
    if (input === "string") calls.push(call("toDateTime"));
    const zone = text(v.zone).trim();
    if (zone) calls.push(call("setZone", zone));
    const preset = text(v.preset, "date");
    const locale = text(v.locale).trim() || "en-US";
    if (preset === "iso") calls.push(call("toISO"));
    else if (preset === "custom")
      calls.push(call("toFormat", text(v.pattern).trim() || "dd LLL yyyy", locale));
    else calls.push(call(PRESET_METHODS[preset] ?? "toDateString", locale));
    return calls;
  },
  match: (calls, at) => {
    let i = at;
    if (isCall(calls[i], "toDateTime")) i++;
    let zone = "";
    const z = calls[i];
    if (isCall(z, "setZone", 1) && typeof z.args[0] === "string") {
      zone = z.args[0];
      i++;
    }
    const c = calls[i];
    if (!c || c.args === null) return null;
    const preset = Object.keys(PRESET_METHODS).find((p) => PRESET_METHODS[p] === c.name);
    if (!preset) return null;
    const [first, second] = c.args;
    if (preset === "iso") {
      if (c.args.length) return null;
      return {
        values: { preset, pattern: "dd LLL yyyy", zone, locale: "en-US" },
        used: i - at + 1
      };
    }
    if (preset === "custom") {
      if (typeof first !== "string" || (second !== undefined && typeof second !== "string"))
        return null;
      return {
        values: { preset, pattern: first, zone, locale: text(second, "en-US") },
        used: i - at + 1
      };
    }
    if (c.args.length > 1 || (first !== undefined && typeof first !== "string")) return null;
    return {
      values: { preset, pattern: "dd LLL yyyy", zone, locale: text(first, "en-US") },
      used: i - at + 1
    };
  }
};

/** Every transform, in the order the modal lists them. */
export const TRANSFORMS: TransformDef[] = [
  plain("toNumber", "To number", "Convert", "toNumber", ["string", "boolean"], "number"),
  plain("toInteger", "To whole number", "Convert", "toInteger", ["string", "number"], "number"),
  plain("toBoolean", "To true / false", "Convert", "toBoolean", ["string", "number"], "boolean"),
  {
    id: "toText",
    label: "To text",
    group: "Convert",
    accepts: ["number", "boolean", "array", "object"],
    returns: "string",
    params: [],
    defaults: {},
    // Lists and objects become JSON text.
    toCalls: (_, input) => [
      call(input === "array" || input === "object" ? "toJsonString" : "toString")
    ],
    match: (calls, at) =>
      isCall(calls[at], "toString") || isCall(calls[at], "toJsonString")
        ? { values: {}, used: 1 }
        : null
  },
  plain("parseJson", "Parse JSON", "Convert", "parseJson", ["string"], "any"),
  {
    id: "toDate",
    label: "To date",
    group: "Convert",
    accepts: ["string"],
    returns: "date",
    params: [
      {
        key: "format",
        label: "Read format (empty = ISO or SQL)",
        type: "text",
        placeholder: "dd/MM/yyyy"
      }
    ],
    defaults: { format: "" },
    toCalls: (v) => {
      const format = text(v.format).trim();
      return [format ? call("toDateTime", format) : call("toDateTime")];
    },
    match: (calls, at) => {
      const c = calls[at];
      if (!isCall(c, "toDateTime", 1)) return null;
      const [format] = c.args;
      if (format !== undefined && typeof format !== "string") return null;
      return { values: { format: text(format) }, used: 1 };
    }
  },
  plain("upper", "Uppercase", "Text", "toUpperCase", ["string"], "string"),
  plain("lower", "Lowercase", "Text", "toLowerCase", ["string"], "string"),
  {
    id: "capitalize",
    label: "Capitalize",
    group: "Text",
    accepts: ["string"],
    returns: "string",
    params: [
      {
        key: "mode",
        label: "Capitals on",
        type: "select",
        options: [
          { value: "words", label: "Every word" },
          { value: "first", label: "First letter only" }
        ]
      }
    ],
    defaults: { mode: "words" },
    toCalls: (v) => [call(v.mode === "first" ? "toSentenceCase" : "toTitleCase")],
    match: (calls, at) =>
      isCall(calls[at], "toTitleCase")
        ? { values: { mode: "words" }, used: 1 }
        : isCall(calls[at], "toSentenceCase")
          ? { values: { mode: "first" }, used: 1 }
          : null
  },
  plain("trim", "Trim spaces", "Text", "trim", ["string"], "string"),
  {
    id: "truncate",
    label: "Truncate",
    group: "Text",
    accepts: ["string"],
    returns: "string",
    params: [
      { key: "length", label: "Length", type: "number" },
      { key: "end", label: "Ending", type: "text", placeholder: "…" }
    ],
    defaults: { length: 50, end: "…" },
    toCalls: (v) => {
      const length = Math.max(0, int(v.length, 50));
      const end = text(v.end, "…");
      return [end === "…" ? call("truncate", length) : call("truncate", length, end)];
    },
    match: (calls, at) => {
      const c = calls[at];
      if (!isCall(c, "truncate", 2) || typeof c.args[0] !== "number") return null;
      if (c.args[1] !== undefined && typeof c.args[1] !== "string") return null;
      return { values: { length: c.args[0], end: text(c.args[1], "…") }, used: 1 };
    }
  },
  {
    id: "replace",
    label: "Replace",
    group: "Text",
    accepts: ["string"],
    returns: "string",
    params: [
      { key: "search", label: "Find", type: "text" },
      { key: "with", label: "Replace with", type: "text" },
      { key: "all", label: "Every match", type: "boolean" }
    ],
    defaults: { search: "", with: "", all: true },
    toCalls: (v) => [call(v.all ? "replaceAll" : "replace", text(v.search), text(v.with))],
    match: (calls, at) => {
      const c = calls[at];
      const all = isCall(c, "replaceAll", 2);
      if (!all && !isCall(c, "replace", 2)) return null;
      const [search, by] = c.args as unknown[];
      if (typeof search !== "string" || typeof by !== "string") return null;
      return { values: { search, with: by, all }, used: 1 };
    }
  },
  {
    id: "length",
    label: "Length",
    group: "List",
    accepts: ["array", "string"],
    returns: "number",
    params: [],
    defaults: {},
    toCalls: () => [prop("length")],
    match: (calls, at) =>
      calls[at]?.name === "length" && calls[at]?.args === null ? { values: {}, used: 1 } : null
  },
  {
    id: "join",
    label: "Join items",
    group: "List",
    accepts: ["array"],
    returns: "string",
    params: [{ key: "separator", label: "Separator", type: "text", placeholder: ", " }],
    defaults: { separator: ", " },
    toCalls: (v) => [call("join", text(v.separator, ", "))],
    match: (calls, at) => {
      const c = calls[at];
      if (!isCall(c, "join", 1)) return null;
      if (c.args[0] !== undefined && typeof c.args[0] !== "string") return null;
      return { values: { separator: text(c.args[0], ",") }, used: 1 };
    }
  },
  plain("first", "First item", "List", "first", ["array"], "any"),
  plain("last", "Last item", "List", "last", ["array"], "any"),
  {
    id: "round",
    label: "Round",
    group: "Number",
    accepts: ["number"],
    returns: "number",
    params: [{ key: "decimals", label: "Decimals", type: "number" }],
    defaults: { decimals: 0 },
    toCalls: (v) => {
      const d = Math.min(Math.max(int(v.decimals, 0), 0), 15);
      return [d ? call("round", d) : call("round")];
    },
    match: (calls, at) => {
      const c = calls[at];
      if (!isCall(c, "round", 1)) return null;
      if (c.args[0] !== undefined && typeof c.args[0] !== "number") return null;
      return { values: { decimals: int(c.args[0], 0) }, used: 1 };
    }
  },
  plain("floor", "Round down", "Number", "floor", ["number"], "number"),
  plain("ceil", "Round up", "Number", "ceil", ["number"], "number"),
  numberFormat,
  dateFormat
];

/** Steps that read several calls (Format date takes toDateTime and setZone) are matched first. */
const MATCH_ORDER = [dateFormat, ...TRANSFORMS.filter((t) => t !== dateFormat)];

export const transformDef = (id: string): TransformDef | undefined =>
  TRANSFORMS.find((t) => t.id === id);

/** The transforms that fit a value of this kind ("any" fits every one). */
export function transformsFor(kind: TransformKind): TransformDef[] {
  return kind === "any" ? TRANSFORMS : TRANSFORMS.filter((t) => t.accepts.includes(kind));
}

/** A new step with the transform's default values. */
export const newTransformStep = (id: string): TransformStep => ({
  id,
  values: { ...(transformDef(id)?.defaults ?? {}) }
});

/** The kind going into each step, then the kind of the result (length = steps + 1). */
export function chainKinds(start: TransformKind, steps: TransformStep[]): TransformKind[] {
  const kinds: TransformKind[] = [start];
  for (const step of steps) kinds.push(transformDef(step.id)?.returns ?? "any");
  return kinds;
}

function literal(value: unknown): string {
  if (typeof value === "string")
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object")
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${k}: ${literal(v)}`)
      .join(", ")} }`;
  return "null";
}

/**
 * The expression a chain compiles to (without the braces). Each step uses `?.` so an empty value
 * passes through to the fallback instead of failing.
 */
export function compileTransformChain(chain: TransformChain, start: TransformKind): string {
  const kinds = chainKinds(start, chain.steps);
  let code = chain.base.trim();
  chain.steps.forEach((step, i) => {
    const def = transformDef(step.id);
    if (!def) return;
    for (const c of def.toCalls(step.values, kinds[i] ?? "any"))
      code += c.args === null ? `?.${c.name}` : `?.${c.name}(${c.args.map(literal).join(", ")})`;
  });
  const fallback = chain.fallback;
  return fallback ? `$ifEmpty(${code}, ${literal(fallback)})` : code;
}

/** A literal argument (text, number, boolean, or an object of those); undefined = not literal. */
function literalValue(node: Node): { ok: boolean; value?: unknown } {
  if (node.t === "lit") return { ok: true, value: node.v };
  if (
    node.t === "unary" &&
    node.op === "-" &&
    node.arg.t === "lit" &&
    typeof node.arg.v === "number"
  )
    return { ok: true, value: -node.arg.v };
  if (node.t === "obj") {
    const out: Record<string, unknown> = {};
    for (const p of node.props) {
      const v = literalValue(p.value);
      if (!v.ok) return { ok: false };
      out[p.key] = v.value;
    }
    return { ok: true, value: out };
  }
  return { ok: false };
}

/** A plain path like app.cart, %posts.item.tags[0] or param["my-id"]; null when it is not one. */
function pathText(node: Node): string | null {
  if (node.t === "id") return node.name;
  if (node.t !== "member" || node.optional) return null;
  const obj = pathText(node.obj);
  if (obj === null) return null;
  if (typeof node.prop === "string") return `${obj}.${node.prop}`;
  if (node.prop.t === "lit" && (typeof node.prop.v === "number" || typeof node.prop.v === "string"))
    return `${obj}[${literal(node.prop.v)}]`;
  return null;
}

/** Splits `base.a(...)?.b` into the base path and its calls; null for anything else. */
function unchain(node: Node): { base: string; calls: Call[] } | null {
  const calls: Call[] = [];
  let n = node;
  for (;;) {
    const path = pathText(n);
    if (path !== null) return { base: path, calls: calls.reverse() };
    if (n.t === "call" && n.callee.t === "member" && typeof n.callee.prop === "string") {
      const args: unknown[] = [];
      for (const a of n.args) {
        const v = literalValue(a);
        if (!v.ok) return null;
        args.push(v.value);
      }
      calls.push({ name: n.callee.prop, args });
      n = n.callee.obj;
    } else if (n.t === "member" && typeof n.prop === "string" && n.optional) {
      calls.push({ name: n.prop, args: null });
      n = n.obj;
    } else return null;
  }
}

/**
 * Reads a tag's expression back into a chain, or null when it is not a base path followed by known
 * transforms (hand-written code is edited in the field). The base keeps any plain path, so a tag
 * like %posts.item.title with no steps reads back as a chain of zero steps.
 */
export function parseTransformChain(expression: string): TransformChain | null {
  let root: Node;
  try {
    root = parseExpression(expression);
  } catch {
    return null;
  }
  let fallback = "";
  if (
    root.t === "call" &&
    root.callee.t === "id" &&
    root.callee.name === "$ifEmpty" &&
    root.args.length === 2
  ) {
    const fb = root.args[1];
    if (fb?.t !== "lit" || typeof fb.v !== "string" || !root.args[0]) return null;
    fallback = fb.v;
    root = root.args[0];
  }
  const parts = unchain(root);
  if (!parts) return null;
  const steps: TransformStep[] = [];
  let at = 0;
  while (at < parts.calls.length) {
    let found: { id: string; values: TransformValues; used: number } | null = null;
    for (const def of MATCH_ORDER) {
      const m = def.match(parts.calls, at);
      if (m && m.used > 0) {
        found = { id: def.id, ...m };
        break;
      }
    }
    if (!found) return null;
    steps.push({ id: found.id, values: found.values });
    at += found.used;
  }
  return { base: parts.base, steps, fallback };
}
