import { DateTime, type DurationLikeObject } from "luxon";
import { ExpressionError } from "./parse";

// What can follow a dot in an expression, per kind of value. One list drives both the evaluator
// and the autocomplete (name, signature, description, example). Methods never mutate their input.

export type ValueKind = "string" | "number" | "boolean" | "array" | "object" | "date" | "null";

export interface MemberDoc {
  name: string;
  kind: "method" | "property";
  /** Shown after the name, for example "(decimals?: number)". */
  signature: string;
  returns: ValueKind | "any";
  description: string;
  example: string;
}

/** A function written in the expression (for map, filter ...), already wired to the evaluator. */
export type Callback = (...args: unknown[]) => unknown;

interface Member extends MemberDoc {
  run: (self: never, args: unknown[]) => unknown;
}

export const MAX_TEXT = 100_000;
export const MAX_ITEMS = 10_000;

export function kindOf(value: unknown): ValueKind {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (DateTime.isDateTime(value)) return "date";
  return "object";
}

const text = (s: string) => {
  if (s.length > MAX_TEXT) throw new ExpressionError("The text is too long.");
  return s;
};
const num = (v: unknown, fallback?: number): number => {
  if (v === undefined && fallback !== undefined) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new ExpressionError("Expected a number.");
  return n;
};
const str = (v: unknown, fallback = ""): string => (v === undefined ? fallback : String(v));
const fn = (v: unknown): Callback => {
  if (typeof v !== "function") throw new ExpressionError("Expected a function like x => x.");
  return v as Callback;
};
const isEmptyValue = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (kindOf(v) === "object" && Object.keys(v as object).length === 0);

const UNITS = new Set([
  "years",
  "quarters",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds"
]);
/** plus(5, "days") or plus({ days: 5 }). */
function duration(amount: unknown, unit: unknown): DurationLikeObject {
  if (amount && typeof amount === "object") return amount as DurationLikeObject;
  const name = str(unit, "days");
  const plural = name.endsWith("s") ? name : `${name}s`;
  if (!UNITS.has(plural)) throw new ExpressionError(`Unknown time unit "${name}".`);
  return { [plural]: num(amount) };
}

const m = (
  name: string,
  signature: string,
  returns: Member["returns"],
  description: string,
  example: string,
  run: Member["run"]
): Member => ({ name, kind: "method", signature, returns, description, example, run });
const p = (
  name: string,
  returns: Member["returns"],
  description: string,
  example: string,
  run: Member["run"]
): Member => ({ name, kind: "property", signature: "", returns, description, example, run });

const STRING: Member[] = [
  p("length", "number", "Number of characters.", '"Hello".length → 5', (s: string) => s.length),
  m(
    "toUpperCase",
    "()",
    "string",
    "All letters in capitals.",
    '"hi".toUpperCase() → "HI"',
    (s: string) => s.toUpperCase()
  ),
  m(
    "toLowerCase",
    "()",
    "string",
    "All letters in small letters.",
    '"Hi".toLowerCase() → "hi"',
    (s: string) => s.toLowerCase()
  ),
  m(
    "toTitleCase",
    "()",
    "string",
    "First letter of every word in capitals.",
    '"new york".toTitleCase() → "New York"',
    (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
  ),
  m(
    "toSentenceCase",
    "()",
    "string",
    "First letter in capitals, the rest small.",
    '"hELLO there".toSentenceCase() → "Hello there"',
    (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  ),
  m(
    "toSnakeCase",
    "()",
    "string",
    "Words joined with _ in small letters.",
    '"Hello World".toSnakeCase() → "hello_world"',
    (s: string) =>
      s
        .trim()
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase()
  ),
  m(
    "toKebabCase",
    "()",
    "string",
    "Words joined with - in small letters.",
    '"Hello World".toKebabCase() → "hello-world"',
    (s: string) =>
      s
        .trim()
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase()
  ),
  m(
    "toCamelCase",
    "()",
    "string",
    "Words joined, each after the first starting with a capital.",
    '"hello world".toCamelCase() → "helloWorld"',
    (s: string) => s.toLowerCase().replace(/[\s_-]+(\w)/g, (_x, c: string) => c.toUpperCase())
  ),
  m("trim", "()", "string", "Removes spaces at both ends.", '"  hi ".trim() → "hi"', (s: string) =>
    s.trim()
  ),
  m(
    "trimStart",
    "()",
    "string",
    "Removes spaces at the start.",
    '"  hi".trimStart() → "hi"',
    (s: string) => s.trimStart()
  ),
  m(
    "trimEnd",
    "()",
    "string",
    "Removes spaces at the end.",
    '"hi  ".trimEnd() → "hi"',
    (s: string) => s.trimEnd()
  ),
  m(
    "includes",
    "(search: string)",
    "boolean",
    "True when the text contains the search text.",
    '"hello".includes("ell") → true',
    (s: string, [a]) => s.includes(str(a))
  ),
  m(
    "startsWith",
    "(search: string)",
    "boolean",
    "True when the text starts with the search text.",
    '"hello".startsWith("he") → true',
    (s: string, [a]) => s.startsWith(str(a))
  ),
  m(
    "endsWith",
    "(search: string)",
    "boolean",
    "True when the text ends with the search text.",
    '"hello".endsWith("lo") → true',
    (s: string, [a]) => s.endsWith(str(a))
  ),
  m(
    "indexOf",
    "(search: string)",
    "number",
    "Position of the first match, or -1.",
    '"hello".indexOf("l") → 2',
    (s: string, [a]) => s.indexOf(str(a))
  ),
  m(
    "slice",
    "(start: number, end?: number)",
    "string",
    "Part of the text between two positions. Negative counts from the end.",
    '"hello".slice(1, 3) → "el"',
    (s: string, [a, b]) => s.slice(num(a, 0), b === undefined ? undefined : num(b))
  ),
  m(
    "substring",
    "(start: number, end?: number)",
    "string",
    "Part of the text between two positions.",
    '"hello".substring(1, 3) → "el"',
    (s: string, [a, b]) => s.substring(num(a, 0), b === undefined ? undefined : num(b))
  ),
  m(
    "split",
    "(separator: string)",
    "array",
    "Cuts the text into a list.",
    '"a,b".split(",") → ["a", "b"]',
    (s: string, [a]) => s.split(str(a)).slice(0, MAX_ITEMS)
  ),
  m(
    "replace",
    "(search: string, with: string)",
    "string",
    "Replaces the first match.",
    '"a-b-c".replace("-", "+") → "a+b-c"',
    (s: string, [a, b]) => text(s.replace(str(a), str(b)))
  ),
  m(
    "replaceAll",
    "(search: string, with: string)",
    "string",
    "Replaces every match.",
    '"a-b-c".replaceAll("-", "+") → "a+b+c"',
    (s: string, [a, b]) => text(s.split(str(a)).join(str(b)))
  ),
  m(
    "padStart",
    "(length: number, fill?: string)",
    "string",
    "Adds the fill text at the start until the length is reached.",
    '"7".padStart(3, "0") → "007"',
    (s: string, [a, b]) => text(s.padStart(Math.min(num(a), MAX_TEXT), str(b, " ")))
  ),
  m(
    "padEnd",
    "(length: number, fill?: string)",
    "string",
    "Adds the fill text at the end until the length is reached.",
    '"7".padEnd(3, "0") → "700"',
    (s: string, [a, b]) => text(s.padEnd(Math.min(num(a), MAX_TEXT), str(b, " ")))
  ),
  m(
    "repeat",
    "(times: number)",
    "string",
    "The text repeated.",
    '"ab".repeat(2) → "abab"',
    (s: string, [a]) => text(s.repeat(Math.max(0, Math.min(num(a), MAX_TEXT))))
  ),
  m(
    "truncate",
    "(length: number, end?: string)",
    "string",
    "Cuts the text to a length and adds an ending (… by default).",
    '"Hello world".truncate(5) → "Hello…"',
    (s: string, [a, b]) => {
      const max = num(a);
      return s.length <= max ? s : s.slice(0, max) + str(b, "…");
    }
  ),
  m(
    "isEmpty",
    "()",
    "boolean",
    "True when the text is empty.",
    '"".isEmpty() → true',
    (s: string) => s.length === 0
  ),
  m(
    "isNotEmpty",
    "()",
    "boolean",
    "True when the text has characters.",
    '"a".isNotEmpty() → true',
    (s: string) => s.length > 0
  ),
  m(
    "isEmail",
    "()",
    "boolean",
    "True when the text looks like an email address.",
    '"a@b.co".isEmail() → true',
    (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
  ),
  m(
    "isUrl",
    "()",
    "boolean",
    "True when the text is an http(s) address.",
    '"https://a.co".isUrl() → true',
    (s: string) => /^https?:\/\/\S+$/i.test(s)
  ),
  m(
    "isNumeric",
    "()",
    "boolean",
    "True when the text is a number.",
    '"12.5".isNumeric() → true',
    (s: string) => s.trim() !== "" && Number.isFinite(Number(s))
  ),
  m(
    "toNumber",
    "()",
    "number",
    "The text read as a number (empty when it is not one).",
    '"12.5".toNumber() → 12.5',
    (s: string) => {
      const n = Number(s);
      return s.trim() === "" || !Number.isFinite(n) ? null : n;
    }
  ),
  m(
    "toInteger",
    "()",
    "number",
    "The text read as a whole number (empty when it is not one).",
    '"42.7".toInteger() → 42',
    (s: string) => {
      const n = Number(s);
      return s.trim() === "" || !Number.isFinite(n) ? null : Math.trunc(n);
    }
  ),
  m(
    "toBoolean",
    "()",
    "boolean",
    'True for "true", "1", "yes" and "on".',
    '"yes".toBoolean() → true',
    (s: string) => ["true", "1", "yes", "on"].includes(s.trim().toLowerCase())
  ),
  m(
    "toDateTime",
    "(format?: string)",
    "date",
    "Reads the text as a date and time (ISO, or with a format like dd/MM/yyyy).",
    '"2026-01-31".toDateTime().toFormat("dd LLL") → "31 Jan"',
    (s: string, [f]) => {
      const d =
        f === undefined ? DateTime.fromISO(s, { setZone: true }) : DateTime.fromFormat(s, str(f));
      const sql = d.isValid ? d : DateTime.fromSQL(s, { setZone: true });
      return sql.isValid ? sql : null;
    }
  ),
  m(
    "parseJson",
    "()",
    "any",
    "Reads the text as JSON.",
    '"{\\"a\\":1}".parseJson().a → 1',
    (s: string) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        return null;
      }
    }
  ),
  m(
    "urlEncode",
    "()",
    "string",
    "Makes the text safe inside a URL.",
    '"a b".urlEncode() → "a%20b"',
    (s: string) => encodeURIComponent(s)
  ),
  m(
    "urlDecode",
    "()",
    "string",
    "Turns %20 and similar back into text.",
    '"a%20b".urlDecode() → "a b"',
    (s: string) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    }
  ),
  m(
    "removeTags",
    "()",
    "string",
    "Removes HTML tags.",
    '"<b>Hi</b>".removeTags() → "Hi"',
    (s: string) => s.replace(/<[^>]*>/g, "")
  ),
  m(
    "extractEmail",
    "()",
    "string",
    "The first email address in the text.",
    '"Mail me at a@b.co".extractEmail() → "a@b.co"',
    (s: string) => /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.exec(s)?.[0] ?? ""
  ),
  m(
    "extractUrl",
    "()",
    "string",
    "The first http(s) address in the text.",
    '"See https://a.co now".extractUrl() → "https://a.co"',
    (s: string) => /https?:\/\/[^\s"'<>]+/.exec(s)?.[0] ?? ""
  ),
  m("toString", "()", "string", "The value as text.", '"a".toString() → "a"', (s: string) => s)
];

const NUMBER: Member[] = [
  m(
    "toFixed",
    "(decimals: number)",
    "string",
    "Text with exactly that many decimals.",
    '3.14159.toFixed(2) → "3.14"',
    (n: number, [a]) => n.toFixed(Math.min(Math.max(num(a, 0), 0), 20))
  ),
  m(
    "round",
    "(decimals?: number)",
    "number",
    "Rounds to that many decimals (0 by default).",
    "3.456.round(1) → 3.5",
    (n: number, [a]) => {
      const f = 10 ** Math.min(Math.max(num(a, 0), 0), 15);
      return Math.round(n * f) / f;
    }
  ),
  m(
    "toInteger",
    "()",
    "number",
    "The whole part of the number.",
    "3.9.toInteger() → 3",
    (n: number) => Math.trunc(n)
  ),
  m("floor", "()", "number", "Rounds down to a whole number.", "3.9.floor() → 3", (n: number) =>
    Math.floor(n)
  ),
  m("ceil", "()", "number", "Rounds up to a whole number.", "3.1.ceil() → 4", (n: number) =>
    Math.ceil(n)
  ),
  m("abs", "()", "number", "The number without its minus sign.", "(-4).abs() → 4", (n: number) =>
    Math.abs(n)
  ),
  m(
    "format",
    "(locale?: string, options?: object)",
    "string",
    'Number with the separators of a language; options as in Intl.NumberFormat, e.g. { style: "currency", currency: "EUR" }.',
    '1234.5.format("en-US") → "1,234.5"',
    (n: number, [a, b]) => {
      try {
        return new Intl.NumberFormat(
          a === undefined ? "en-US" : str(a),
          (b ?? {}) as Intl.NumberFormatOptions
        ).format(n);
      } catch {
        throw new ExpressionError("Unknown language or number format.");
      }
    }
  ),
  m(
    "toLocaleString",
    "(locale?: string)",
    "string",
    "Number with the separators of a language.",
    '1234.5.toLocaleString("de-DE") → "1.234,5"',
    (n: number, [a]) => {
      try {
        return n.toLocaleString(a === undefined ? "en-US" : str(a));
      } catch {
        throw new ExpressionError("Unknown language.");
      }
    }
  ),
  m(
    "isEven",
    "()",
    "boolean",
    "True for even whole numbers.",
    "4.isEven() → true",
    (n: number) => n % 2 === 0
  ),
  m(
    "isOdd",
    "()",
    "boolean",
    "True for odd whole numbers.",
    "3.isOdd() → true",
    (n: number) => Math.abs(n % 2) === 1
  ),
  m("isInteger", "()", "boolean", "True for whole numbers.", "3.isInteger() → true", (n: number) =>
    Number.isInteger(n)
  ),
  m(
    "toBoolean",
    "()",
    "boolean",
    "False for 0, true otherwise.",
    "0.toBoolean() → false",
    (n: number) => n !== 0
  ),
  m(
    "toDateTime",
    '(unit?: "ms" | "s")',
    "date",
    'A date from a Unix time in milliseconds (or seconds with "s").',
    '1700000000.toDateTime("s").toISODate() → "2023-11-14"',
    (n: number, [u]) => (u === "s" ? DateTime.fromSeconds(n) : DateTime.fromMillis(n))
  ),
  m("toString", "()", "string", "The number as text.", '42.toString() → "42"', (n: number) =>
    String(n)
  )
];

const BOOLEAN: Member[] = [
  m("toNumber", "()", "number", "1 for true, 0 for false.", "true.toNumber() → 1", (b: boolean) =>
    b ? 1 : 0
  ),
  m("toString", "()", "string", '"true" or "false".', 'true.toString() → "true"', (b: boolean) =>
    String(b)
  )
];

const sortKey = (v: unknown) => (typeof v === "number" ? v : String(v ?? ""));
const compare = (a: unknown, b: unknown) => {
  const x = sortKey(a);
  const y = sortKey(b);
  return x < y ? -1 : x > y ? 1 : 0;
};
const numbers = (list: unknown[]) => list.filter((v): v is number => typeof v === "number");
const field = (item: unknown, key: string) =>
  item && typeof item === "object" && Object.hasOwn(item, key)
    ? (item as Record<string, unknown>)[key]
    : undefined;

const ARRAY: Member[] = [
  p("length", "number", "Number of items.", "[1, 2].length → 2", (a: unknown[]) => a.length),
  m("first", "()", "any", "The first item.", "[1, 2].first() → 1", (a: unknown[]) => a[0] ?? null),
  m(
    "last",
    "()",
    "any",
    "The last item.",
    "[1, 2].last() → 2",
    (a: unknown[]) => a[a.length - 1] ?? null
  ),
  m(
    "at",
    "(index: number)",
    "any",
    "The item at a position; negative counts from the end.",
    "[1, 2, 3].at(-1) → 3",
    (a: unknown[], [i]) => a.at(num(i)) ?? null
  ),
  m(
    "join",
    "(separator?: string)",
    "string",
    "The items as one text.",
    '["a", "b"].join(", ") → "a, b"',
    (a: unknown[], [s]) =>
      text(
        a
          .map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : str(v)))
          .join(str(s, ","))
      )
  ),
  m(
    "includes",
    "(value)",
    "boolean",
    "True when the list contains the value.",
    "[1, 2].includes(2) → true",
    (a: unknown[], [v]) => a.includes(v)
  ),
  m(
    "indexOf",
    "(value)",
    "number",
    "Position of the value, or -1.",
    '["a", "b"].indexOf("b") → 1',
    (a: unknown[], [v]) => a.indexOf(v)
  ),
  m(
    "slice",
    "(start: number, end?: number)",
    "array",
    "Part of the list between two positions.",
    "[1, 2, 3].slice(1) → [2, 3]",
    (a: unknown[], [s, e]) => a.slice(num(s, 0), e === undefined ? undefined : num(e))
  ),
  m(
    "concat",
    "(other: array)",
    "array",
    "This list followed by another.",
    "[1].concat([2]) → [1, 2]",
    (a: unknown[], [b]) => [...a, ...(Array.isArray(b) ? b : [b])].slice(0, MAX_ITEMS)
  ),
  m(
    "reverse",
    "()",
    "array",
    "The items in reverse order.",
    "[1, 2].reverse() → [2, 1]",
    (a: unknown[]) => [...a].reverse()
  ),
  m(
    "sort",
    "(by?: x => value)",
    "array",
    "Sorted items, optionally by a value of each.",
    "users.sort(u => u.age)",
    (a: unknown[], [f]) =>
      f === undefined ? [...a].sort(compare) : [...a].sort((x, y) => compare(fn(f)(x), fn(f)(y)))
  ),
  m(
    "map",
    "(x => value)",
    "array",
    "A new list with each item turned into something else.",
    "[1, 2].map(x => x * 2) → [2, 4]",
    (a: unknown[], [f]) => a.map((x, i) => fn(f)(x, i))
  ),
  m(
    "filter",
    "(x => condition)",
    "array",
    "Only the items for which the condition is true.",
    "[1, 2, 3].filter(x => x > 1) → [2, 3]",
    (a: unknown[], [f]) => a.filter((x, i) => Boolean(fn(f)(x, i)))
  ),
  m(
    "find",
    "(x => condition)",
    "any",
    "The first item for which the condition is true.",
    "users.find(u => u.id === 3)",
    (a: unknown[], [f]) => a.find((x, i) => Boolean(fn(f)(x, i))) ?? null
  ),
  m(
    "findIndex",
    "(x => condition)",
    "number",
    "Position of the first matching item, or -1.",
    "[5, 8].findIndex(x => x > 6) → 1",
    (a: unknown[], [f]) => a.findIndex((x, i) => Boolean(fn(f)(x, i)))
  ),
  m(
    "some",
    "(x => condition)",
    "boolean",
    "True when at least one item matches.",
    "[1, 5].some(x => x > 4) → true",
    (a: unknown[], [f]) => a.some((x, i) => Boolean(fn(f)(x, i)))
  ),
  m(
    "every",
    "(x => condition)",
    "boolean",
    "True when all items match.",
    "[1, 5].every(x => x > 0) → true",
    (a: unknown[], [f]) => a.every((x, i) => Boolean(fn(f)(x, i)))
  ),
  m(
    "reduce",
    "((total, x) => value, start)",
    "any",
    "Combines all items into one value.",
    "[1, 2, 3].reduce((t, x) => t + x, 0) → 6",
    (a: unknown[], [f, start]) => a.reduce((t, x, i) => fn(f)(t, x, i), start)
  ),
  m("sum", "()", "number", "The total of the numbers.", "[1, 2, 3].sum() → 6", (a: unknown[]) =>
    numbers(a).reduce((t, x) => t + x, 0)
  ),
  m(
    "average",
    "()",
    "number",
    "The average of the numbers.",
    "[2, 4].average() → 3",
    (a: unknown[]) => {
      const list = numbers(a);
      return list.length === 0 ? null : list.reduce((t, x) => t + x, 0) / list.length;
    }
  ),
  m("min", "()", "number", "The smallest number.", "[3, 1].min() → 1", (a: unknown[]) =>
    numbers(a).length ? Math.min(...numbers(a)) : null
  ),
  m("max", "()", "number", "The largest number.", "[3, 1].max() → 3", (a: unknown[]) =>
    numbers(a).length ? Math.max(...numbers(a)) : null
  ),
  m(
    "unique",
    "(by?: string)",
    "array",
    "Items without repeats, optionally compared by a field.",
    "[1, 1, 2].unique() → [1, 2]",
    (a: unknown[], [k]) => {
      const seen = new Set<string>();
      return a.filter((x) => {
        const key = JSON.stringify(k === undefined ? x : field(x, str(k)));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  ),
  m(
    "compact",
    "()",
    "array",
    'Items without empty values (null, "", empty lists and objects).',
    '[1, null, ""].compact() → [1]',
    (a: unknown[]) => a.filter((x) => !isEmptyValue(x))
  ),
  m(
    "pluck",
    "(field: string)",
    "array",
    "The value of one field from each item.",
    'users.pluck("name") → ["Ann", "Bo"]',
    (a: unknown[], [k]) => a.map((x) => field(x, str(k)) ?? null)
  ),
  m(
    "chunk",
    "(size: number)",
    "array",
    "The list cut into lists of that size.",
    "[1, 2, 3].chunk(2) → [[1, 2], [3]]",
    (a: unknown[], [s]) => {
      const size = Math.max(1, Math.floor(num(s)));
      const out: unknown[][] = [];
      for (let i = 0; i < a.length; i += size) out.push(a.slice(i, i + size));
      return out;
    }
  ),
  m(
    "flat",
    "()",
    "array",
    "Lists inside the list are opened up one level.",
    "[[1], [2]].flat() → [1, 2]",
    (a: unknown[]) => a.flat().slice(0, MAX_ITEMS)
  ),
  m(
    "isEmpty",
    "()",
    "boolean",
    "True when the list has no items.",
    "[].isEmpty() → true",
    (a: unknown[]) => a.length === 0
  ),
  m(
    "isNotEmpty",
    "()",
    "boolean",
    "True when the list has items.",
    "[1].isNotEmpty() → true",
    (a: unknown[]) => a.length > 0
  ),
  m(
    "toJsonString",
    "()",
    "string",
    "The list as JSON text.",
    '[1, 2].toJsonString() → "[1,2]"',
    (a: unknown[]) => text(JSON.stringify(a))
  )
];

const OBJECT: Member[] = [
  m("keys", "()", "array", "The field names.", '{ a: 1 }.keys() → ["a"]', (o: object) =>
    Object.keys(o)
  ),
  m("values", "()", "array", "The field values.", "{ a: 1 }.values() → [1]", (o: object) =>
    Object.values(o)
  ),
  m(
    "hasField",
    "(name: string)",
    "boolean",
    "True when the object has that field.",
    '{ a: 1 }.hasField("a") → true',
    (o: object, [k]) => Object.hasOwn(o, str(k))
  ),
  m(
    "removeField",
    "(name: string)",
    "object",
    "A copy without that field.",
    '{ a: 1, b: 2 }.removeField("a") → { b: 2 }',
    (o: object, [k]) => {
      const copy: Record<string, unknown> = { ...o };
      delete copy[str(k)];
      return copy;
    }
  ),
  m(
    "merge",
    "(other: object)",
    "object",
    "A copy with the other object's fields added.",
    "{ a: 1 }.merge({ b: 2 }) → { a: 1, b: 2 }",
    (o: object, [b]) =>
      b && typeof b === "object" && !Array.isArray(b) ? { ...o, ...b } : { ...o }
  ),
  m(
    "compact",
    "()",
    "object",
    "A copy without empty fields.",
    "{ a: 1, b: null }.compact() → { a: 1 }",
    (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => !isEmptyValue(v)))
  ),
  m(
    "isEmpty",
    "()",
    "boolean",
    "True when the object has no fields.",
    "{}.isEmpty() → true",
    (o: object) => Object.keys(o).length === 0
  ),
  m(
    "isNotEmpty",
    "()",
    "boolean",
    "True when the object has fields.",
    "{ a: 1 }.isNotEmpty() → true",
    (o: object) => Object.keys(o).length > 0
  ),
  m(
    "toJsonString",
    "()",
    "string",
    "The object as JSON text.",
    '{ a: 1 }.toJsonString() → "{\\"a\\":1}"',
    (o: object) => text(JSON.stringify(o))
  )
];

const DATE: Member[] = [
  m(
    "toFormat",
    "(format: string, locale?: string)",
    "string",
    "The date as text in a format: yyyy year, MM month, dd day, HH hour, mm minutes, ss seconds, LLL short month, cccc weekday. The language names months and weekdays.",
    '$now.toFormat("yyyy-MM-dd") → "2026-11-07"',
    (d: DateTime, [f, l]) => text(d.setLocale(str(l, "en-US")).toFormat(str(f, "yyyy-MM-dd HH:mm")))
  ),
  m(
    "toISO",
    "()",
    "string",
    "ISO 8601 date and time.",
    '$now.toISO() → "2026-11-07T09:30:00.000+00:00"',
    (d: DateTime) => d.toISO() ?? ""
  ),
  m(
    "toISODate",
    "()",
    "string",
    "ISO date only.",
    '$now.toISODate() → "2026-11-07"',
    (d: DateTime) => d.toISODate() ?? ""
  ),
  m(
    "toRelative",
    "(locale?: string)",
    "string",
    "How long ago or from now, in words.",
    '$now.minus(2, "hours").toRelative() → "2 hours ago"',
    (d: DateTime, [l]) => d.toRelative({ locale: str(l, "en") }) ?? ""
  ),
  m(
    "toLocaleString",
    "(locale?: string)",
    "string",
    "Date and time the way a language writes it.",
    '$now.toLocaleString("en-GB") → "07/11/2026, 09:30:00"',
    (d: DateTime, [l]) => d.setLocale(str(l, "en-US")).toLocaleString(DateTime.DATETIME_SHORT)
  ),
  m(
    "toDateString",
    "(locale?: string)",
    "string",
    "The date the way a language writes it.",
    '$now.toDateString("en-US") → "Nov 7, 2026"',
    (d: DateTime, [l]) => d.setLocale(str(l, "en-US")).toLocaleString(DateTime.DATE_MED)
  ),
  m(
    "toTimeString",
    "(locale?: string)",
    "string",
    "The time the way a language writes it.",
    '$now.toTimeString("en-US") → "9:30 AM"',
    (d: DateTime, [l]) => d.setLocale(str(l, "en-US")).toLocaleString(DateTime.TIME_SIMPLE)
  ),
  m(
    "plus",
    "(amount: number, unit: string)",
    "date",
    "Later by an amount: years, months, weeks, days, hours, minutes, seconds.",
    '$now.plus(7, "days")',
    (d: DateTime, [a, u]) => d.plus(duration(a, u))
  ),
  m(
    "minus",
    "(amount: number, unit: string)",
    "date",
    "Earlier by an amount.",
    '$now.minus(1, "month")',
    (d: DateTime, [a, u]) => d.minus(duration(a, u))
  ),
  m(
    "startOf",
    "(unit: string)",
    "date",
    "The start of the year, month, week, day or hour.",
    '$now.startOf("month")',
    (d: DateTime, [u]) => d.startOf(str(u, "day") as "day")
  ),
  m(
    "endOf",
    "(unit: string)",
    "date",
    "The end of the year, month, week, day or hour.",
    '$now.endOf("day")',
    (d: DateTime, [u]) => d.endOf(str(u, "day") as "day")
  ),
  m(
    "setZone",
    "(zone: string)",
    "date",
    "The same moment in another time zone.",
    '$now.setZone("Asia/Kolkata")',
    (d: DateTime, [z]) => {
      const zoned = d.setZone(str(z, "UTC"));
      if (!zoned.isValid) throw new ExpressionError(`Unknown time zone "${str(z)}".`);
      return zoned;
    }
  ),
  m(
    "diffTo",
    "(other, unit?: string)",
    "number",
    "How many units from this date to another (days by default).",
    '$today.diffTo("2026-12-25".toDateTime(), "days")',
    (d: DateTime, [o, u]) => {
      if (!DateTime.isDateTime(o)) throw new ExpressionError("Expected a date to compare with.");
      const unit = str(u, "days");
      return Math.round(o.diff(d, unit as "days").get(unit as "days"));
    }
  ),
  m(
    "isBefore",
    "(other)",
    "boolean",
    "True when this date is earlier.",
    '$now.isBefore($now.plus(1, "day")) → true',
    (d: DateTime, [o]) => DateTime.isDateTime(o) && d < o
  ),
  m(
    "isAfter",
    "(other)",
    "boolean",
    "True when this date is later.",
    "$now.isAfter($today) → true",
    (d: DateTime, [o]) => DateTime.isDateTime(o) && d > o
  ),
  m("toMillis", "()", "number", "Unix time in milliseconds.", "$now.toMillis()", (d: DateTime) =>
    d.toMillis()
  ),
  m("toSeconds", "()", "number", "Unix time in seconds.", "$now.toSeconds()", (d: DateTime) =>
    Math.floor(d.toSeconds())
  ),
  p("year", "number", "The year.", "$now.year → 2026", (d: DateTime) => d.year),
  p("month", "number", "The month, 1 to 12.", "$now.month → 11", (d: DateTime) => d.month),
  p("day", "number", "The day of the month.", "$now.day → 7", (d: DateTime) => d.day),
  p("hour", "number", "The hour, 0 to 23.", "$now.hour → 9", (d: DateTime) => d.hour),
  p("minute", "number", "The minute.", "$now.minute → 30", (d: DateTime) => d.minute),
  p("second", "number", "The second.", "$now.second → 0", (d: DateTime) => d.second),
  p(
    "weekday",
    "number",
    "Day of the week, 1 (Monday) to 7 (Sunday).",
    "$now.weekday → 6",
    (d: DateTime) => d.weekday
  ),
  p(
    "weekdayLong",
    "string",
    "Name of the weekday.",
    '$now.weekdayLong → "Saturday"',
    (d: DateTime) => d.weekdayLong ?? ""
  ),
  p(
    "monthLong",
    "string",
    "Name of the month.",
    '$now.monthLong → "November"',
    (d: DateTime) => d.monthLong ?? ""
  )
];

const TABLES: Record<ValueKind, Member[]> = {
  string: STRING,
  number: NUMBER,
  boolean: BOOLEAN,
  array: ARRAY,
  object: OBJECT,
  date: DATE,
  null: []
};

/** The method or property `name` for a value of `kind`, if there is one. */
export function memberOf(kind: ValueKind, name: string): Member | undefined {
  return TABLES[kind].find((x) => x.name === name);
}

/** Every method and property for a kind of value (for the autocomplete). */
export function membersOf(kind: ValueKind): MemberDoc[] {
  return TABLES[kind].map(({ run: _run, ...doc }) => doc);
}
