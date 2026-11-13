// SVG sanitizer for uploads and inline SVG (docs/ui-reference.md 4.6, CLAUDE.md "Sanitize ... SVG").
// A parser-based allowlist that needs no DOM, so it runs the same under Bun, Node and the browser.
// The result is rebuilt from what the allowlist accepts; anything else is left out. Constructs that
// cannot be made safe by trimming (DOCTYPE and ENTITY declarations, broken markup) refuse the file.

const BOM = new RegExp("^" + String.fromCharCode(0xfeff));

export class SvgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvgError";
  }
}

const ELEMENTS = new Set(
  (
    "svg g defs symbol use path rect circle ellipse line polyline polygon text tspan textPath " +
    "linearGradient radialGradient stop pattern clipPath mask marker title desc style switch " +
    "filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix " +
    "feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB " +
    "feFuncG feFuncR feGaussianBlur feMerge feMergeNode feMorphology feOffset fePointLight " +
    "feSpecularLighting feSpotLight feTile feTurbulence"
  ).split(" ")
);
/** Dropped together with everything inside them. */
const DROP_WITH_CONTENT = new Set([
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "canvas",
  "animate",
  "set",
  "animateMotion",
  "animateTransform",
  "handler",
  "listener",
  "image",
  "a",
  "metadata"
]);

/** SMIL animation. Kept only in icon mode: animated icons (spinners, line animations) need it. */
const ANIMATION = new Set(["animate", "set", "animateTransform", "animateMotion"]);

/** An animation may not rewrite an attribute that loads or runs something (links, handlers). */
function animationTargetsUnsafe(attrs: readonly (readonly [string, string])[]): boolean {
  for (const [name, value] of attrs) {
    if (name.toLowerCase() !== "attributename") continue;
    const target = value.trim().toLowerCase();
    if (target === "href" || target === "xlink:href" || target.startsWith("on")) return true;
  }
  return false;
}

export interface SanitizeOptions {
  /** Keep safe SMIL animation (icon libraries). Media uploads leave this off. */
  animations?: boolean;
}

const MAX_DEPTH = 64;
const MAX_NODES = 40_000;

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      if (
        !Number.isFinite(code) ||
        code <= 0 ||
        code > 0x10ffff ||
        (code >= 0xd800 && code <= 0xdfff)
      )
        return "";
      return String.fromCodePoint(code);
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

/** Strips control characters and whitespace tricks so `java\tscript:` is read as it would run. */
const flatten = (s: string) => {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const skip =
      c <= 0x20 ||
      (c >= 0x7f && c <= 0x9f) ||
      (c >= 0x200b && c <= 0x200f) ||
      c === 0x2028 ||
      c === 0x2029 ||
      c === 0xfeff;
    if (!skip) out += ch;
  }
  return out.toLowerCase();
};

/** True when a CSS or attribute value holds a way to run code or fetch something outside the file. */
export function unsafeValue(value: string): boolean {
  const flat = flatten(value);
  if (
    /(javascript|vbscript|data):/.test(flat) &&
    !/^data:image\/(png|jpeg|gif|webp);base64,/.test(flat)
  )
    return true;
  if (/expression\(|@import|behavior:|-moz-binding|\\0|&#/.test(flat)) return true;
  for (const m of flat.matchAll(/url\(([^)]*)\)/g)) {
    const target = (m[1] ?? "").replace(/^["']|["']$/g, "");
    if (!target.startsWith("#")) return true;
  }
  return false;
}

/** CSS inside <style>: the same limits, checked on the text with comments removed. */
export function safeCss(css: string): boolean {
  return !unsafeValue(css.replace(/\/\*[\s\S]*?\*\//g, ""));
}

interface Open {
  name: string;
  kept: boolean;
}

const NAME = /^[A-Za-z_][\w.-]*$/;
const ATTR_NAME = /^[A-Za-z_:][\w:.-]*$/;
const ALLOWED_PREFIXED = new Set(["xlink:href", "xml:space", "xml:lang", "xmlns:xlink", "xmlns"]);

function keepAttribute(name: string, value: string): string | null {
  if (!ATTR_NAME.test(name)) return null;
  const lower = name.toLowerCase();
  if (lower.startsWith("on")) return null;
  if (name.includes(":") && !ALLOWED_PREFIXED.has(lower)) return null;
  if (lower === "xmlns") return value === "http://www.w3.org/2000/svg" ? value : null;
  if (lower === "xmlns:xlink") return value === "http://www.w3.org/1999/xlink" ? value : null;
  if (lower === "href" || lower === "xlink:href")
    return value.trim().startsWith("#") ? value.trim() : null;
  if (unsafeValue(value)) return null;
  return value;
}

/**
 * Returns safe SVG text, or throws `SvgError` when the file is not an SVG or cannot be cleaned.
 * Comments, processing instructions, scripts, event handlers, external references and
 * non-allowlisted elements never appear in the result.
 */
export function sanitizeSvg(source: string, options: SanitizeOptions = {}): string {
  const allowAnimation = options.animations === true;
  const text = source.replace(BOM, "");
  if (/<!doctype/i.test(text) || /<!entity/i.test(text))
    throw new SvgError("SVG files with a DOCTYPE or ENTITY declaration are not accepted.");
  let out = "";
  const stack: Open[] = [];
  let skipDepth = 0; // > 0 while inside a dropped element
  let nodes = 0;
  let rootSeen = false;
  let rootClosed = false;
  let i = 0;

  const fail = (): never => {
    throw new SvgError("This file is not a valid SVG.");
  };

  while (i < text.length) {
    if (text[i] !== "<") {
      const end = text.indexOf("<", i);
      const chunk = text.slice(i, end === -1 ? text.length : end);
      i = end === -1 ? text.length : end;
      if (stack.length === 0) {
        if (chunk.trim() !== "") fail();
        continue;
      }
      const top = stack[stack.length - 1]!;
      if (skipDepth > 0 || !top.kept) continue;
      const decoded = decodeEntities(chunk);
      if (top.name === "style") {
        if (safeCss(decoded)) out += escText(decoded);
      } else out += escText(decoded);
      continue;
    }
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) fail();
      i = end + 3;
      continue;
    }
    if (text.startsWith("<![CDATA[", i)) {
      const end = text.indexOf("]]>", i + 9);
      if (end === -1) fail();
      const raw = text.slice(i + 9, end);
      i = end + 3;
      const top = stack[stack.length - 1];
      if (!top || skipDepth > 0 || !top.kept) continue;
      if (top.name === "style") {
        if (safeCss(raw)) out += escText(raw);
      } else out += escText(raw);
      continue;
    }
    if (text.startsWith("<?", i)) {
      const end = text.indexOf("?>", i + 2);
      if (end === -1) fail();
      i = end + 2;
      continue;
    }
    if (text.startsWith("<!", i)) fail();
    if (text[i + 1] === "/") {
      const end = text.indexOf(">", i);
      if (end === -1) fail();
      const name = text.slice(i + 2, end).trim();
      i = end + 1;
      const open = stack.pop();
      if (!open || open.name !== name) fail();
      if (skipDepth > 0) {
        skipDepth--;
        if (stack.length === 0) rootClosed = true;
        continue;
      }
      if (open!.kept) out += `</${name}>`;
      if (stack.length === 0) rootClosed = true;
      continue;
    }
    // Opening or self-closing tag: scan name, then attributes with quote awareness.
    let j = i + 1;
    while (j < text.length && !/[\s/>]/.test(text[j]!)) j++;
    const name = text.slice(i + 1, j);
    if (!NAME.test(name)) fail();
    const attrs: [string, string][] = [];
    let selfClose = false;
    for (;;) {
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (j >= text.length) fail();
      if (text[j] === ">") {
        j++;
        break;
      }
      if (text[j] === "/") {
        if (text[j + 1] !== ">") fail();
        selfClose = true;
        j += 2;
        break;
      }
      const start = j;
      while (j < text.length && !/[\s=/>]/.test(text[j]!)) j++;
      const attr = text.slice(start, j);
      if (attr === "") fail();
      while (j < text.length && /\s/.test(text[j]!)) j++;
      let value = "";
      if (text[j] === "=") {
        j++;
        while (j < text.length && /\s/.test(text[j]!)) j++;
        const quote = text[j];
        if (quote !== '"' && quote !== "'") fail();
        const close = text.indexOf(quote!, j + 1);
        if (close === -1) fail();
        value = text.slice(j + 1, close);
        j = close + 1;
      }
      attrs.push([attr, decodeEntities(value)]);
    }
    i = j;
    if (++nodes > MAX_NODES) throw new SvgError("This SVG is too complex.");
    if (rootClosed) fail();
    if (stack.length === 0) {
      if (name !== "svg") throw new SvgError("This file is not an SVG image.");
      rootSeen = true;
    }
    if (stack.length >= MAX_DEPTH) throw new SvgError("This SVG is nested too deeply.");

    const animation = allowAnimation && ANIMATION.has(name);
    const dropped =
      skipDepth > 0 || (animation ? animationTargetsUnsafe(attrs) : DROP_WITH_CONTENT.has(name));
    const kept =
      !dropped &&
      (ELEMENTS.has(name) || animation) &&
      (stack.length === 0 || stack[stack.length - 1]!.kept);
    if (dropped) {
      if (selfClose) {
        if (stack.length === 0) fail();
      } else {
        stack.push({ name, kept: false });
        skipDepth++;
      }
      continue;
    }
    if (kept) {
      let tag = `<${name}`;
      const seen = new Set<string>();
      for (const [attr, value] of attrs) {
        if (seen.has(attr)) fail();
        seen.add(attr);
        const safe = keepAttribute(attr, value);
        if (safe !== null) tag += ` ${attr}="${escAttr(safe)}"`;
      }
      out += selfClose ? `${tag}/>` : `${tag}>`;
    }
    if (selfClose) {
      if (stack.length === 0) rootClosed = true;
    } else {
      stack.push({ name, kept });
      // An unknown element is dropped but its allowed children would float up; drop them too.
      if (!kept) skipDepth++;
    }
  }
  if (stack.length > 0 || !rootSeen) fail();
  return out;
}
