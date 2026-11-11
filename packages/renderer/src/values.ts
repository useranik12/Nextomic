import type { PropValue } from "@nextomic/schema";

export type TokenResolver = (token: string) => string;

const emptyToken: TokenResolver = () => "";

/** Flattens a static or mixed value to text. Dynamic tokens resolve through `resolveToken`. */
export function resolveText(
  value: PropValue | undefined,
  resolveToken: TokenResolver = emptyToken
): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return value.parts
    .map((part) => (typeof part === "string" ? part : resolveToken(part.token)))
    .join("");
}

export function resolveBoolean(value: PropValue | undefined): boolean {
  return value === true || value === "true";
}

export { safeUrl } from "@nextomic/schema";
