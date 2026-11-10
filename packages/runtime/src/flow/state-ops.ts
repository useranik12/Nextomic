import { toText, typedValue, type TypedText } from "@nextomic/schema";
import { FlowError } from "./engine";

// Update App State / Update Page State operations. Values are kept as text, the way the page's
// dynamic context stores them: scalars as plain text, lists and JSON as JSON text.

export const STATE_OPS = [
  "set",
  "reset",
  "toggle",
  "increment",
  "decrement",
  "append",
  "prepend",
  "remove",
  "removeAt",
  "clear"
] as const;
export type StateOp = (typeof STATE_OPS)[number];

/** The stored text of a value. */
export function valueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "toISO" in value && typeof value.toISO === "function") {
    return String(value.toISO());
  }
  return JSON.stringify(value);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The new stored text of a variable after one operation. */
export function applyStateOp(
  op: string,
  current: string,
  initial: string,
  value: unknown,
  spec: TypedText | undefined
): string {
  const now = typedValue(current, spec);
  const list = () => (Array.isArray(now) ? [...(now as unknown[])] : []);
  const amount = () => {
    const n = typeof value === "number" ? value : Number(toText(value) || "1");
    if (!Number.isFinite(n)) throw new FlowError("bad-value", "Increment needs a number.");
    return n;
  };
  switch (op as StateOp) {
    case "set":
      return valueText(value);
    case "reset":
      return initial;
    case "toggle":
      return String(now !== true);
    case "increment":
      return String((typeof now === "number" ? now : 0) + amount());
    case "decrement":
      return String((typeof now === "number" ? now : 0) - amount());
    case "append":
      return JSON.stringify([...list(), value]);
    case "prepend":
      return JSON.stringify([value, ...list()]);
    case "remove":
      return JSON.stringify(list().filter((item) => !same(item, value)));
    case "removeAt": {
      const index = Number(toText(value));
      return JSON.stringify(list().filter((_, i) => i !== index));
    }
    case "clear":
      return spec?.isList ? "[]" : "";
    default:
      throw new FlowError("bad-operation", `Unknown state operation "${op}".`);
  }
}
