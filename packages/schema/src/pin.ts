import type { ElementNode } from "./element";

// PIN / OTP field (elements.md "Forms"): one box per character. The element holds its value as
// one text (the boxes joined), so `{{ form.<form>.<field> }}` gives the whole code. The rules
// below are shared by the renderer (box count, input mode, validation rules) and the runtime
// (which characters a box accepts and how typed or pasted text spreads over the boxes).

export const PIN_TYPE = "pinInput";

export const PIN_LENGTH_MIN = 2;
export const PIN_LENGTH_MAX = 12;
export const PIN_LENGTH_DEFAULT = 6;

export const PIN_CHARSETS = ["numeric", "letters", "alphanumeric", "any"] as const;
export type PinCharset = (typeof PIN_CHARSETS)[number];

export const PIN_CHARSET_LABELS: Record<PinCharset, string> = {
  numeric: "Numbers",
  letters: "Letters",
  alphanumeric: "Letters and numbers",
  any: "Any character"
};

export const pinCharsetOf = (value: unknown): PinCharset =>
  PIN_CHARSETS.find((charset) => charset === value) ?? "numeric";

/** The regular expression class of one allowed character (null: any character but a space). */
const CHAR_CLASS: Record<PinCharset, string | null> = {
  numeric: "[0-9]",
  letters: "\\p{L}",
  alphanumeric: "[\\p{L}\\p{N}]",
  any: null
};

/** Whether one character may sit in a box of this character set. */
export function pinAccepts(charset: PinCharset, char: string): boolean {
  const cls = CHAR_CLASS[charset];
  return cls ? new RegExp(`^${cls}$`, "u").test(char) : char.trim() !== "";
}

/** The pattern a whole code must match; empty for "any character". */
export function pinPattern(charset: PinCharset): string {
  const cls = CHAR_CLASS[charset];
  return cls ? `^${cls}*$` : "";
}

/** The words the "wrong character" message uses. */
export const PIN_CHARSET_WORDS: Record<PinCharset, string> = {
  numeric: "Use numbers only.",
  letters: "Use letters only.",
  alphanumeric: "Use letters and numbers only.",
  any: ""
};

/** The number of boxes: a whole number from the minimum to the maximum, else the default. */
export function pinLengthOf(text: string): number {
  const n = Number(text);
  return Number.isInteger(n) && n >= PIN_LENGTH_MIN && n <= PIN_LENGTH_MAX ? n : PIN_LENGTH_DEFAULT;
}

/** Why a written length cannot be used, or null (a length that holds dynamic tags is not checked). */
export function pinLengthProblem(node: ElementNode): string | null {
  const raw = node.props.length;
  if (raw === undefined || raw === "" || typeof raw === "object") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= PIN_LENGTH_MIN && n <= PIN_LENGTH_MAX
    ? null
    : `"${typeof node.props.name === "string" ? node.props.name : "PIN"}" needs a length from ${PIN_LENGTH_MIN} to ${PIN_LENGTH_MAX} boxes.`;
}

/**
 * Spreads typed, pasted or autofilled text over the boxes. Text starts in box `from`, unless it is
 * a whole code (as long as the field), which always starts in the first box. Characters the set
 * does not accept are skipped. Returns the new boxes and the box that should take focus next.
 */
export function pinFill(
  boxes: readonly string[],
  from: number,
  text: string,
  charset: PinCharset
): { boxes: string[]; focus: number } {
  const chars = [...text].filter((char) => pinAccepts(charset, char));
  const next = [...boxes];
  if (chars.length === 0) return { boxes: next, focus: Math.min(from, next.length - 1) };
  const start = chars.length >= next.length ? 0 : from;
  let last = start;
  chars.slice(0, next.length - start).forEach((char, i) => {
    next[start + i] = char;
    last = start + i;
  });
  return { boxes: next, focus: Math.min(last + 1, next.length - 1) };
}
