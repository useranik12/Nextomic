import postcss from "postcss";
import { z } from "zod";
import { iconSvg } from "./icon-render";
import { ICON_NAME_PATTERN, iconifySetSchema, type IconifySet } from "./icons";
import { sanitizeSvg, SvgError } from "./svg-sanitize";

// Parsers for custom icon libraries (docs/fonts-and-icons.md 3.4). All input is untrusted: nothing
// uploaded is served or executed. Font metadata is read (IcoMoon `selection.json`, Fontello
// `config.json`, or the CSS that came with a font), the CSS is parsed and thrown away, and SVG
// files go through the sanitizer before they become icons.

export class IconImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IconImportError";
  }
}

/** Lowercase words joined by hyphens, as icon names and library keys must be. */
export function slugIconName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}

export interface Glyph {
  name: string;
  /** Unicode codepoint. */
  code: number;
}

/** A glyph a font can draw as one character: not a control or surrogate, inside Unicode. */
const validCode = (code: number): boolean =>
  Number.isInteger(code) && code >= 0x21 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);

/**
 * Turns raw glyph entries into the stored name to hex map: names slugged, entries without a valid
 * name or codepoint dropped, duplicate names numbered (`home`, `home-2`).
 */
export function glyphMap(entries: readonly Glyph[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, code } of entries) {
    const base = slugIconName(name);
    if (!base || !ICON_NAME_PATTERN.test(base) || !validCode(code)) continue;
    let unique = base;
    for (let n = 2; unique in out; n++) unique = `${base}-${n}`;
    out[unique] = code.toString(16);
  }
  return out;
}

// ---- IcoMoon and Fontello -----------------------------------------------------------------------

const icomoonSchema = z.object({
  icons: z.array(
    z.object({
      properties: z
        .object({ name: z.string().optional(), code: z.number().optional() })
        .passthrough()
    })
  )
});

/** IcoMoon `selection.json`: `properties.name` (may list several names, the first is used) and the decimal `code`. */
export function parseIcoMoon(json: unknown): Glyph[] {
  const parsed = icomoonSchema.safeParse(json);
  if (!parsed.success) throw new IconImportError("This is not an IcoMoon selection.json.");
  return parsed.data.icons.flatMap(({ properties }) => {
    const name = properties.name?.split(",")[0]?.trim();
    return name && properties.code !== undefined ? [{ name, code: properties.code }] : [];
  });
}

const fontelloSchema = z.object({
  glyphs: z.array(z.object({ css: z.string(), code: z.number() }).passthrough())
});

/** Fontello `config.json`: each glyph has its CSS name and decimal `code`. */
export function parseFontello(json: unknown): Glyph[] {
  const parsed = fontelloSchema.safeParse(json);
  if (!parsed.success) throw new IconImportError("This is not a Fontello config.json.");
  return parsed.data.glyphs.map((g) => ({ name: g.css, code: g.code }));
}

// ---- Generic icon font CSS ----------------------------------------------------------------------

const SELECTOR = /^\.([A-Za-z_][\w-]*)::?(?:before|after)$/;

/** The one character a CSS `content` string draws: `"\e900"`, `"\\e900"` or the character itself. */
function contentCode(value: string): number | null {
  const m = /^(["'])([\s\S]*)\1$/.exec(value.trim());
  if (!m) return null;
  const text = m[2]!.replace(/^\\\\/, "\\");
  const escaped = /^\\([0-9a-fA-F]{1,6})\s?$/.exec(text);
  if (escaped) return parseInt(escaped[1]!, 16);
  const chars = [...text];
  return chars.length === 1 ? chars[0]!.codePointAt(0)! : null;
}

/** Class names minus the prefix most of them share (`icon-`, `fa-`, `bi-`). */
function stripPrefix(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const n of names) {
    const dash = n.indexOf("-");
    if (dash > 0) counts.set(n.slice(0, dash + 1), (counts.get(n.slice(0, dash + 1)) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!best || best[1] < Math.max(2, names.length / 2)) return names;
  return names.map((n) => (n.startsWith(best[0]) ? n.slice(best[0].length) : n));
}

/**
 * The class to codepoint map of an icon font's CSS (`.prefix-name:before { content: "\e900" }`).
 * The CSS is only read; the builder writes its own @font-face and rules.
 */
export function parseIconFontCss(css: string): Glyph[] {
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    throw new IconImportError("This CSS file could not be read.");
  }
  const found: { className: string; code: number }[] = [];
  root.walkRules((rule) => {
    let code: number | null = null;
    rule.walkDecls("content", (decl) => {
      code = contentCode(decl.value);
    });
    if (code === null) return;
    for (const selector of rule.selectors) {
      const match = SELECTOR.exec(selector.trim());
      if (match) found.push({ className: match[1]!, code });
    }
  });
  const names = stripPrefix(found.map((f) => f.className));
  return found.map((f, i) => ({ name: names[i]!, code: f.code }));
}

// ---- SVG files ----------------------------------------------------------------------------------

export type SvgIcon = {
  body: string;
  width: number;
  height: number;
  left?: number;
  top?: number;
};

const ROOT_STYLE = new Set(
  (
    "fill fill-opacity fill-rule clip-rule stroke stroke-width stroke-linecap stroke-linejoin " +
    "stroke-miterlimit stroke-opacity stroke-dasharray stroke-dashoffset opacity color"
  ).split(" ")
);
const KEEP_VALUE = /^(none|currentcolor|inherit|transparent|url\()/i;

/** Replaces fixed fill and stroke colors with `currentColor` (attributes and inline styles). */
function recolor(body: string): string {
  const swap = (value: string) => (KEEP_VALUE.test(value.trim()) ? value : "currentColor");
  return body
    .replace(
      /\b(fill|stroke)="([^"]*)"/g,
      (_m, prop: string, value: string) => `${prop}="${swap(value)}"`
    )
    .replace(
      /\b(fill|stroke)\s*:\s*([^;"]+)/g,
      (_m, prop: string, value: string) => `${prop}:${swap(value)}`
    );
}

const attrsOf = (open: string): Map<string, string> => {
  const map = new Map<string, string>();
  for (const m of open.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) map.set(m[1]!, m[2]!);
  return map;
};

/**
 * An SVG file as an icon: sanitized (safe animation kept), sized from its `viewBox` (or width and
 * height), and with the root's drawing attributes moved onto the body so nothing is lost when only
 * the body is kept. `keepColors: false` recolors to `currentColor`.
 */
export function svgToIcon(source: string, keepColors: boolean): SvgIcon {
  let clean: string;
  try {
    clean = sanitizeSvg(source, { animations: true });
  } catch (error) {
    if (error instanceof SvgError) throw new IconImportError(error.message);
    throw error;
  }
  const open = /^<svg\b([^>]*?)(\/?)>/.exec(clean);
  const end = clean.lastIndexOf("</svg>");
  if (!open || open[2] === "/" || end < 0)
    throw new IconImportError("This SVG has no drawing in it.");
  const attrs = attrsOf(open[1]!);
  let [left, top, width, height] = (attrs.get("viewBox") ?? "").split(/[\s,]+/).map(Number) as [
    number,
    number,
    number,
    number
  ];
  if (![left, top, width, height].every(Number.isFinite) || !(width > 0) || !(height > 0)) {
    const w = parseFloat(attrs.get("width") ?? "");
    const h = parseFloat(attrs.get("height") ?? "");
    if (!(w > 0) || !(h > 0)) throw new IconImportError("This SVG needs a viewBox.");
    [left, top, width, height] = [0, 0, w, h];
  }
  let body = clean.slice(open[0].length, end);
  if (body.trim() === "") throw new IconImportError("This SVG has no drawing in it.");
  const style = [...attrs].filter(([name]) => ROOT_STYLE.has(name));
  if (!keepColors && !attrs.has("fill")) style.push(["fill", "currentColor"]);
  if (style.length > 0) body = `<g ${style.map(([k, v]) => `${k}="${v}"`).join(" ")}>${body}</g>`;
  if (!keepColors) body = recolor(body);
  return {
    body,
    width,
    height,
    ...(left !== 0 ? { left } : {}),
    ...(top !== 0 ? { top } : {})
  };
}

// ---- Iconify JSON -------------------------------------------------------------------------------

/**
 * A pasted or uploaded Iconify set under our own key. Icons whose markup cannot be made safe, and
 * names that are not valid icon names, are left out and counted.
 */
export function normalizeIconifySet(
  json: unknown,
  key: string
): { set: IconifySet; skipped: number } {
  const parsed = iconifySetSchema.safeParse(json);
  if (!parsed.success) throw new IconImportError("This is not an Iconify icon set.");
  const raw = parsed.data;
  let skipped = 0;
  const icons: IconifySet["icons"] = {};
  for (const [name, icon] of Object.entries(raw.icons)) {
    const drawn = ICON_NAME_PATTERN.test(name)
      ? iconSvg({ ...raw, icons: { [name]: icon } }, name)
      : null;
    // Sanitizing can leave an empty <svg>: a body that was only a script is not an icon.
    if (drawn && !/^<svg[^>]*><\/svg>$/.test(drawn)) icons[name] = icon;
    else skipped++;
  }
  const aliases: NonNullable<IconifySet["aliases"]> = {};
  for (const [name, alias] of Object.entries(raw.aliases ?? {})) {
    if (ICON_NAME_PATTERN.test(name) && alias.parent in icons) aliases[name] = alias;
    else skipped++;
  }
  if (Object.keys(icons).length === 0) throw new IconImportError("No usable icons were found.");
  return {
    set: { ...raw, prefix: key, icons, ...(Object.keys(aliases).length ? { aliases } : {}) },
    skipped
  };
}
