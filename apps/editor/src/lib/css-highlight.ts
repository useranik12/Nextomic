// A small CSS tokenizer for the code editor's colors. It never rejects input: unknown text is
// returned as plain `text`, so half-typed CSS still highlights.

export type CssTokenType =
  | "comment"
  | "at"
  | "class"
  | "id"
  | "pseudo"
  | "tag"
  | "attr"
  | "property"
  | "number"
  | "color"
  | "string"
  | "function"
  | "important"
  | "punct"
  | "text";

export interface CssToken {
  type: CssTokenType;
  text: string;
}

type Block = "nested" | "decl";

// Blocks that hold more rules; every other block holds declarations.
const NESTED_AT = /^@(media|supports|layer|container|document)\b/i;

const SELECTOR_PARTS: [RegExp, CssTokenType][] = [
  [/^\.[\w-]+/, "class"],
  [/^#[\w-]+/, "id"],
  [/^::?[\w-]+(\([^)]*\))?/, "pseudo"],
  [/^\[[^\]]*\]/, "attr"],
  [/^[a-zA-Z][\w-]*/, "tag"],
  [/^[>+~*,]/, "punct"]
];

const VALUE_PARTS: [RegExp, CssTokenType][] = [
  [/^"(?:[^"\\\n]|\\.)*"?|^'(?:[^'\\\n]|\\.)*'?/, "string"],
  [/^#[0-9a-fA-F]{3,8}\b/, "color"],
  [/^!\s*important/i, "important"],
  [/^-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?/, "number"],
  [/^[a-zA-Z_-][\w-]*(?=\()/, "function"],
  [/^[(),/]/, "punct"]
];

function scan(text: string, parts: [RegExp, CssTokenType][], out: CssToken[]): void {
  let rest = text;
  let plain = "";
  const flush = () => {
    if (plain) out.push({ type: "text", text: plain });
    plain = "";
  };
  while (rest.length > 0) {
    let matched = false;
    for (const [pattern, type] of parts) {
      const m = pattern.exec(rest);
      if (m && m[0].length > 0) {
        flush();
        out.push({ type, text: m[0] });
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Words and spaces pass through as one text run; a lone odd character as itself.
      const word = /^[\w-]+|^\s+|^[\s\S]/.exec(rest)?.[0] ?? rest.slice(0, 1);
      plain += word;
      rest = rest.slice(word.length);
    }
  }
  flush();
}

export function tokenizeCss(source: string): CssToken[] {
  const out: CssToken[] = [];
  const stack: Block[] = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const comment = /^\/\*[\s\S]*?(?:\*\/|$)/.exec(rest);
    if (comment) {
      out.push({ type: "comment", text: comment[0] });
      i += comment[0].length;
      continue;
    }
    const ws = /^\s+/.exec(rest);
    if (ws) {
      out.push({ type: "text", text: ws[0] });
      i += ws[0].length;
      continue;
    }
    if (rest[0] === "}") {
      stack.pop();
      out.push({ type: "punct", text: "}" });
      i += 1;
      continue;
    }
    if (stack[stack.length - 1] === "decl") {
      // property : value ;
      const decl = /^([^:;{}]*)(:?)([^;{}]*)(;?)/.exec(rest);
      if (!decl) break;
      const [whole, name = "", colon = "", value = "", semi = ""] = decl;
      if (name) out.push({ type: "property", text: name });
      if (colon) out.push({ type: "punct", text: colon });
      if (value) scan(value, VALUE_PARTS, out);
      if (semi) out.push({ type: "punct", text: semi });
      i += whole.length;
      continue;
    }
    // Rule prelude: a selector list or an at-rule header, up to { or ;
    const prelude = /^([^{};]*)([{;]?)/.exec(rest);
    if (!prelude) break;
    const [whole, head = "", end = ""] = prelude;
    if (head.trimStart().startsWith("@")) {
      const lead = head.length - head.trimStart().length;
      const name = /^@[\w-]+/.exec(head.trimStart())?.[0] ?? "@";
      if (lead) out.push({ type: "text", text: head.slice(0, lead) });
      out.push({ type: "at", text: name });
      scan(head.slice(lead + name.length), VALUE_PARTS, out);
    } else if (head) {
      scan(head, SELECTOR_PARTS, out);
    }
    if (end) out.push({ type: "punct", text: end });
    if (end === "{") stack.push(NESTED_AT.test(head.trim()) ? "nested" : "decl");
    i += whole.length;
    if (whole.length === 0) break;
  }
  return out;
}
