// Finds the {{ expression }} parts of a text. Everything outside {{ }} is plain text. Braces and
// quotes inside an expression are balanced, so {{ {a: 1}.keys() }} and {{ "}}" }} work.
// A tag needs a space on both sides inside the braces, n8n style (owner decision 2026-11-09):
// `{{ user.name }}` is a tag, `{{user.name}}` is plain text.

/** True when the text between {{ and }} has the spaces that make it a tag. */
const spaced = (inner: string) => /^\s[\s\S]*\s$|^\s+$/.test(inner);

/** The tag text for a dynamic data token: `{{ token }}` (spaces already written are kept). */
export const tagText = (token: string) =>
  spaced(token) ? `{{${token}}}` : `{{ ${token.trim()} }}`;

export interface ExpressionPart {
  /** The text between {{ and }}, trimmed. */
  expr: string;
  /** Offsets of the whole {{ ... }} in the source. */
  start: number;
  end: number;
}

/** The end offset (after "}}") of the expression that opens at `start`, or -1 if it is not closed. */
function closeOf(text: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 2; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") {
      if (depth === 0 && text[i + 1] === "}") return i + 2;
      if (depth > 0) depth--;
    }
  }
  return -1;
}

/** Text and expression parts in order. A {{ without its }} stays plain text. */
export function splitTemplate(text: string): (string | ExpressionPart)[] {
  const parts: (string | ExpressionPart)[] = [];
  let last = 0;
  let i = text.indexOf("{{");
  while (i !== -1) {
    const end = closeOf(text, i);
    if (end === -1) break;
    if (!spaced(text.slice(i + 2, end - 2))) {
      // Not a tag: stays text; a tag may still open inside it ({{a {{ b }}).
      i = text.indexOf("{{", i + 1);
      continue;
    }
    if (i > last) parts.push(text.slice(last, i));
    parts.push({ expr: text.slice(i + 2, end - 2).trim(), start: i, end });
    last = end;
    i = text.indexOf("{{", end);
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** The open expression the caret is in: the text from just after "{{" to the caret, or null. */
export function expressionAtCaret(
  text: string,
  caret: number
): { start: number; source: string } | null {
  const open = text.lastIndexOf("{{", caret - 1);
  if (open === -1) return null;
  const end = closeOf(text, open);
  // The caret is inside when the expression is still open or closes after the caret.
  if (end !== -1 && end - 2 < caret) return null;
  return { start: open + 2, source: text.slice(open + 2, caret) };
}

/** A `{{x}}` written without the spaces that make it a tag (it shows as plain text). */
export interface UnspacedTag {
  /** The text between the braces, as written. */
  inner: string;
  start: number;
  end: number;
}

/** Every closed `{{x}}` whose inside is not spaced on both sides (and is not empty). */
export function unspacedTags(text: string): UnspacedTag[] {
  const found: UnspacedTag[] = [];
  let i = text.indexOf("{{");
  while (i !== -1) {
    const end = closeOf(text, i);
    if (end === -1) break;
    const inner = text.slice(i + 2, end - 2);
    if (spaced(inner)) {
      i = text.indexOf("{{", end);
      continue;
    }
    if (inner.trim()) found.push({ inner, start: i, end });
    i = text.indexOf("{{", i + 1);
  }
  return found;
}

/** The tag a `{{x}}` becomes when fixed: `{{ x }}`. */
export const fixedTag = (tag: UnspacedTag) => tagText(tag.inner);
