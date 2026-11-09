// Parser for expressions written inside {{ }} (n8n style): a safe subset of JavaScript expressions.
// Literals, names, dot and bracket access (also ?.), calls, arrow functions (for map, filter ...),
// arithmetic, comparison, logical operators, ?? and the ternary. No assignment, no `new`, no
// statements. The result is a tree the evaluator walks; nothing is ever passed to eval/Function.

export type Node =
  | { t: "lit"; v: string | number | boolean | null | undefined }
  | { t: "id"; name: string }
  | { t: "member"; obj: Node; prop: string | Node; optional: boolean }
  | { t: "call"; callee: Node; args: Node[]; optional: boolean }
  | { t: "unary"; op: "!" | "-" | "+" | "typeof"; arg: Node }
  | { t: "bin"; op: string; l: Node; r: Node }
  | { t: "cond"; test: Node; yes: Node; no: Node }
  | { t: "arr"; items: Node[] }
  | { t: "obj"; props: { key: string; value: Node }[] }
  | { t: "arrow"; params: string[]; body: Node }
  | { t: "tpl"; parts: (string | Node)[] };

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

type Tok =
  | { k: "num"; v: number; at: number }
  | { k: "str"; v: string; at: number }
  | { k: "tpl"; v: string; at: number }
  | { k: "id"; v: string; at: number }
  | { k: "p"; v: string; at: number };

const PUNCT = [
  "===",
  "!==",
  "?.",
  "??",
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ".",
  ",",
  ":",
  "?",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "!"
];
const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", "0": "\0" };
const MAX_SOURCE = 5000;

/** Whether a token ends a value, so a following "%" is the modulo operator. */
function endsValue(tok: Tok | undefined): boolean {
  if (!tok) return false;
  if (tok.k === "p") return tok.v === ")" || tok.v === "]" || tok.v === "}";
  return tok.k !== "id" || tok.v !== "typeof";
}

/** The tokens of an expression (for tools that rewrite names in place). */
export function lexExpression(src: string): readonly Tok[] {
  return lex(src);
}

export type ExpressionToken = Tok;

function lex(src: string): Tok[] {
  if (src.length > MAX_SOURCE) throw new ExpressionError("The expression is too long.");
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // After a name or a closing bracket, ".0" is index access (items.0), not the number 0.5.
    const prev = out[out.length - 1];
    const afterValue =
      prev !== undefined &&
      (prev.k === "id" || (prev.k === "p" && (prev.v === ")" || prev.v === "]")));
    if (/[0-9]/.test(c) || (c === "." && !afterValue && /[0-9]/.test(src[i + 1] ?? ""))) {
      // A number directly after a dot (items.0.name) is a whole index, never a decimal.
      const index = prev?.k === "p" && prev.v === ".";
      const m = (index ? /^\d+/ : /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i).exec(src.slice(i));
      const text = m?.[0] ?? c;
      out.push({ k: "num", v: Number(text), at: i });
      i += text.length;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const text = /^[A-Za-z_$][\w$]*/.exec(src.slice(i))?.[0] ?? c;
      out.push({ k: "id", v: text, at: i });
      i += text.length;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let v = "";
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") {
          const next = src[j + 1] ?? "";
          v += ESCAPES[next] ?? next;
          j += 2;
        } else v += src[j++];
      }
      if (j >= src.length) throw new ExpressionError("A text value is missing its closing quote.");
      out.push({ k: c === "`" ? "tpl" : "str", v, at: i });
      i = j + 1;
      continue;
    }
    // "%name" where a value starts is a query loop (%posts.item.title); after a value it is modulo.
    if (c === "%" && !endsValue(prev) && /[A-Za-z_]/.test(src[i + 1] ?? "")) {
      const text = /^%[A-Za-z_]\w*/.exec(src.slice(i))?.[0] ?? c;
      out.push({ k: "id", v: text, at: i });
      i += text.length;
      continue;
    }
    const p = PUNCT.find((x) => src.startsWith(x, i));
    if (!p) throw new ExpressionError(`Unexpected "${c}".`);
    // "?." followed by a digit is a ternary with a decimal, not optional chaining.
    if (p === "?." && /[0-9]/.test(src[i + 2] ?? "")) {
      out.push({ k: "p", v: "?", at: i });
      i += 1;
      continue;
    }
    out.push({ k: "p", v: p, at: i });
    i += p.length;
  }
  return out;
}

const BINARY: { ops: string[] }[] = [
  { ops: ["??"] },
  { ops: ["||"] },
  { ops: ["&&"] },
  { ops: ["===", "!==", "==", "!="] },
  { ops: ["<", ">", "<=", ">="] },
  { ops: ["+", "-"] },
  { ops: ["*", "/", "%"] }
];

class Parser {
  private i = 0;
  constructor(private readonly toks: Tok[]) {}

  private peek(offset = 0): Tok | undefined {
    return this.toks[this.i + offset];
  }
  private isP(v: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t?.k === "p" && t.v === v;
  }
  private take(v: string): void {
    if (!this.isP(v)) {
      const t = this.peek();
      throw new ExpressionError(t ? `Expected "${v}" near "${String(t.v)}".` : `Expected "${v}".`);
    }
    this.i++;
  }

  parse(): Node {
    const node = this.expr();
    const rest = this.peek();
    if (rest) throw new ExpressionError(`Unexpected "${String(rest.v)}".`);
    return node;
  }

  private expr(): Node {
    if (this.arrowAhead()) return this.arrow();
    const test = this.binary(0);
    if (!this.isP("?")) return test;
    this.i++;
    const yes = this.expr();
    this.take(":");
    return { t: "cond", test, yes, no: this.expr() };
  }

  private arrowAhead(): boolean {
    const t = this.peek();
    if (t?.k === "id" && this.isP("=>", 1)) return true;
    if (!this.isP("(")) return false;
    let j = 1;
    if (this.isP(")", j)) return this.isP("=>", j + 1);
    while (this.peek(j)?.k === "id") {
      j++;
      if (this.isP(")", j)) return this.isP("=>", j + 1);
      if (!this.isP(",", j)) return false;
      j++;
    }
    return false;
  }

  private arrow(): Node {
    const params: string[] = [];
    const t = this.peek();
    if (t?.k === "id") {
      params.push(t.v);
      this.i++;
    } else {
      this.take("(");
      while (!this.isP(")")) {
        const p = this.peek();
        if (p?.k !== "id") throw new ExpressionError("Expected a parameter name.");
        params.push(p.v);
        this.i++;
        if (this.isP(",")) this.i++;
      }
      this.take(")");
    }
    this.take("=>");
    return { t: "arrow", params, body: this.expr() };
  }

  private binary(level: number): Node {
    const group = BINARY[level];
    if (!group) return this.unary();
    let left = this.binary(level + 1);
    for (;;) {
      const t = this.peek();
      if (t?.k !== "p" || !group.ops.includes(t.v)) return left;
      this.i++;
      left = { t: "bin", op: t.v, l: left, r: this.binary(level + 1) };
    }
  }

  private unary(): Node {
    const t = this.peek();
    if (t?.k === "p" && (t.v === "!" || t.v === "-" || t.v === "+")) {
      this.i++;
      return { t: "unary", op: t.v, arg: this.unary() };
    }
    if (t?.k === "id" && t.v === "typeof") {
      this.i++;
      return { t: "unary", op: "typeof", arg: this.unary() };
    }
    return this.postfix(this.primary());
  }

  private postfix(start: Node): Node {
    let node = start;
    for (;;) {
      if (this.isP(".") || this.isP("?.")) {
        const optional = this.isP("?.");
        this.i++;
        if (optional && this.isP("(")) {
          node = { t: "call", callee: node, args: this.args(), optional: true };
          continue;
        }
        if (optional && this.isP("[")) {
          this.i++;
          const prop = this.expr();
          this.take("]");
          node = { t: "member", obj: node, prop, optional: true };
          continue;
        }
        const name = this.peek();
        if (name?.k === "num") {
          // items.0 reads item 0, like items[0].
          this.i++;
          node = { t: "member", obj: node, prop: { t: "lit", v: name.v }, optional };
          continue;
        }
        if (name?.k !== "id") throw new ExpressionError("Expected a name after the dot.");
        this.i++;
        node = { t: "member", obj: node, prop: name.v, optional };
      } else if (this.isP("[")) {
        this.i++;
        const prop = this.expr();
        this.take("]");
        node = { t: "member", obj: node, prop, optional: false };
      } else if (this.isP("(")) {
        node = { t: "call", callee: node, args: this.args(), optional: false };
      } else return node;
    }
  }

  private args(): Node[] {
    this.take("(");
    const args: Node[] = [];
    while (!this.isP(")")) {
      args.push(this.expr());
      if (!this.isP(")")) this.take(",");
    }
    this.take(")");
    return args;
  }

  private primary(): Node {
    const t = this.peek();
    if (!t) throw new ExpressionError("The expression ends too early.");
    this.i++;
    if (t.k === "num" || t.k === "str") return { t: "lit", v: t.v };
    if (t.k === "tpl") return template(t.v);
    if (t.k === "id") {
      if (t.v === "true") return { t: "lit", v: true };
      if (t.v === "false") return { t: "lit", v: false };
      if (t.v === "null") return { t: "lit", v: null };
      if (t.v === "undefined") return { t: "lit", v: undefined };
      if (t.v === "new" || t.v === "function" || t.v === "this")
        throw new ExpressionError(`"${t.v}" cannot be used in an expression.`);
      return { t: "id", name: t.v };
    }
    if (t.v === "(") {
      const inner = this.expr();
      this.take(")");
      return inner;
    }
    if (t.v === "[") {
      const items: Node[] = [];
      while (!this.isP("]")) {
        items.push(this.expr());
        if (!this.isP("]")) this.take(",");
      }
      this.take("]");
      return { t: "arr", items };
    }
    if (t.v === "{") {
      const props: { key: string; value: Node }[] = [];
      while (!this.isP("}")) {
        const key = this.peek();
        if (key?.k !== "id" && key?.k !== "str")
          throw new ExpressionError("Expected a field name in the object.");
        this.i++;
        this.take(":");
        props.push({ key: String(key.v), value: this.expr() });
        if (!this.isP("}")) this.take(",");
      }
      this.take("}");
      return { t: "obj", props };
    }
    throw new ExpressionError(`Unexpected "${t.v}".`);
  }
}

/** `Hello ${name}` : text parts and expression parts. */
function template(raw: string): Node {
  const parts: (string | Node)[] = [];
  let last = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "$" || raw[i + 1] !== "{") continue;
    let depth = 1;
    let j = i + 2;
    while (j < raw.length && depth > 0) {
      if (raw[j] === "{") depth++;
      else if (raw[j] === "}") depth--;
      j++;
    }
    if (depth > 0) throw new ExpressionError("A ${ in the text is not closed.");
    if (i > last) parts.push(raw.slice(last, i));
    parts.push(parseExpression(raw.slice(i + 2, j - 1)));
    last = j;
    i = j - 1;
  }
  if (last < raw.length) parts.push(raw.slice(last));
  return { t: "tpl", parts };
}

const cache = new Map<string, Node>();
const CACHE_LIMIT = 500;

/** Parses an expression (the text between {{ and }}). Throws ExpressionError when it is not valid. */
export function parseExpression(source: string): Node {
  const hit = cache.get(source);
  if (hit) return hit;
  const node = new Parser(lex(source)).parse();
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(source, node);
  return node;
}
