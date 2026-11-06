import { z } from "zod";
import type { ElementNode } from "./element";
import { walkElements } from "./element";
import type { StyleMap } from "./style";

// Project fonts (docs/fonts-and-icons.md section 2). Font files live in storage under
// `fonts/<projectId>/<fontId>/<file>` and are served by the app itself, so built sites make no
// requests to Google or any font CDN. Only fonts marked `active` are written to the output.

export const FONT_FORMATS = ["woff2", "woff", "ttf", "otf"] as const;
export const fontFormatSchema = z.enum(FONT_FORMATS);
export type FontFormat = z.infer<typeof fontFormatSchema>;

export const FONT_MIME: Record<FontFormat, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf"
};

export const FONT_FORMAT_CSS: Record<FontFormat, string> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype"
};

export const FONT_FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.\-+]*$/;
export const FONT_FILE_PATTERN = /^[a-z0-9][a-z0-9._-]*\.(woff2|woff|ttf|otf)$/;
export const UNICODE_RANGE_PATTERN =
  /^U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?(,\s*U\+[0-9A-Fa-f?]{1,6}(-[0-9A-Fa-f]{1,6})?)*$/;

export const fontFileSchema = z.object({
  /** Stored file name inside the font's folder. */
  file: z.string().regex(FONT_FILE_PATTERN).max(96),
  format: fontFormatSchema,
  /** Static fonts: the weight. Variable fonts: the lower end of the range. */
  weight: z.number().int().min(1).max(1000),
  /** Variable fonts only: the upper end of the weight range. */
  weightMax: z.number().int().min(1).max(1000).optional(),
  style: z.enum(["normal", "italic"]),
  subset: z.string().trim().min(1).max(32).default("latin"),
  unicodeRange: z.string().regex(UNICODE_RANGE_PATTERN).max(2000).optional(),
  bytes: z.number().int().min(1).max(10_000_000),
  sha256: z.string().regex(/^[0-9a-f]{64}$/)
});
export type FontFile = z.infer<typeof fontFileSchema>;

export const FONT_SOURCES = ["google", "upload"] as const;

export const fontSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(64),
  family: z.string().regex(FONT_FAMILY_PATTERN).max(64),
  source: z.enum(FONT_SOURCES),
  /** Where it came from, for the details panel (for example "Fontsource inter@5.3.0"). */
  sourceNote: z.string().max(200).default(""),
  category: z
    .enum(["sans-serif", "serif", "monospace", "display", "handwriting", "other"])
    .default("other"),
  license: z.string().max(80).default(""),
  /** Shown first in the font manager. */
  favorite: z.boolean().default(false),
  /** Written to the output only while active. */
  active: z.boolean().default(true),
  preload: z.boolean().default(false),
  display: z.enum(["swap", "fallback", "optional", "block", "auto"]).default("swap"),
  // A custom font starts with no faces and gets them in the font editor; it loads nothing until it has one.
  files: z.array(fontFileSchema).max(60),
  // The user confirmed they may use and distribute the font files. Without it a custom font is
  // never written to the site and text that names it falls back to the next font in its stack.
  rights: z.boolean().default(true)
});
export type ProjectFont = z.infer<typeof fontSchema>;

export const fontListSchema = z
  .array(fontSchema)
  .max(40)
  .refine(
    (list) =>
      new Set(list.map((f) => f.id)).size === list.length &&
      new Set(list.map((f) => f.family.toLowerCase())).size === list.length,
    { message: "Font ids and families must be unique." }
  );

/** A font is written to the site only while it is on and its use is confirmed. */
export const isFontUsable = (f: Pick<ProjectFont, "active" | "rights">): boolean =>
  f.active && f.rights;

/** Faces from the lowest weight to the highest, normal before italic, then by subset. */
export function sortFontFiles<
  T extends Pick<FontFile, "weight" | "weightMax" | "style" | "subset">
>(files: readonly T[]): T[] {
  return [...files].sort(
    (a, b) =>
      a.weight - b.weight ||
      (a.weightMax ?? a.weight) - (b.weightMax ?? b.weight) ||
      a.style.localeCompare(b.style) ||
      a.subset.localeCompare(b.subset)
  );
}

export const FONT_SOFT_LIMIT_FILES = 6;
export const FONT_SOFT_LIMIT_BYTES = 300_000;

export const SYSTEM_FONT_STACKS: { label: string; value: string }[] = [
  {
    label: "System UI",
    value: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  },
  { label: "Sans serif", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: "Serif", value: "Georgia, Cambria, 'Times New Roman', Times, serif" },
  {
    label: "Monospace",
    value: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
  }
];

export const slugifyFontId = (family: string): string =>
  family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const GENERIC: Record<ProjectFont["category"], string> = {
  "sans-serif": "sans-serif",
  serif: "serif",
  monospace: "monospace",
  display: "sans-serif",
  handwriting: "cursive",
  other: "sans-serif"
};

/** The CSS `font-family` value for a font: its quoted name plus a generic fallback. */
export function fontStack(font: Pick<ProjectFont, "family" | "category">): string {
  return `"${font.family}", ${GENERIC[font.category]}`;
}

export const fontUrl = (base: string, font: Pick<ProjectFont, "id">, file: FontFile): string =>
  `${base}/${font.id}/${file.file}`;

/** Total bytes a page loads at first view if every active font file were requested. */
export function fontWeight(fonts: readonly ProjectFont[]): { files: number; bytes: number } {
  const files = fonts.filter(isFontUsable).flatMap((f) => f.files);
  return { files: files.length, bytes: files.reduce((sum, f) => sum + f.bytes, 0) };
}

/**
 * `@font-face` rules for every active font. `base` is the URL prefix the files are served from
 * (no trailing slash). Families are validated by the schema, so they cannot break out of the string.
 */
export function fontsCss(fonts: readonly ProjectFont[], base: string): string {
  return fonts
    .filter((f) => isFontUsable(f) && FONT_FAMILY_PATTERN.test(f.family))
    .flatMap((font) =>
      font.files.map((file) => {
        const weight = file.weightMax ? `${file.weight} ${file.weightMax}` : String(file.weight);
        const range = file.unicodeRange ? `unicode-range:${file.unicodeRange};` : "";
        return (
          `@font-face{font-family:"${font.family}";font-style:${file.style};font-weight:${weight};` +
          `font-display:${font.display};src:url("${fontUrl(base, font, file)}") format("${FONT_FORMAT_CSS[file.format]}");${range}}`
        );
      })
    )
    .join("");
}

/** Files to preload: the first latin-or-first file of each preloaded active font, per style. */
export function fontPreloads(
  fonts: readonly ProjectFont[],
  base: string
): { href: string; type: string }[] {
  return fonts
    .filter((f) => isFontUsable(f) && f.preload)
    .flatMap((font) => {
      const latin = font.files.filter((f) => f.subset === "latin");
      const pool = latin.length > 0 ? latin : font.files.slice(0, 1);
      return pool
        .filter((f) => f.style === "normal")
        .slice(0, 2)
        .map((file) => ({ href: fontUrl(base, font, file), type: FONT_MIME[file.format] }));
    });
}

/** Detects the font format from the first bytes. Returns null for anything else. */
export function sniffFontFormat(data: Uint8Array): FontFormat | null {
  if (data.length < 12) return null;
  const tag = String.fromCharCode(data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0);
  if (tag === "wOF2") return "woff2";
  if (tag === "wOFF") return "woff";
  if (tag === "OTTO") return "otf";
  const sfnt = data[0] === 0 && data[1] === 1 && data[2] === 0 && data[3] === 0;
  if (sfnt || tag === "true") return "ttf";
  return null;
}

// ---- Usage -------------------------------------------------------------------------------------

/** True when a CSS font-family list names the family (quoted or bare), whole name only. */
export function mentionsFamily(text: string, family: string): boolean {
  const want = family.toLowerCase();
  const lists = [...text.matchAll(/font-family\s*:\s*([^;}]*)/gi)].map((m) => m[1] ?? "");
  return (lists.length > 0 ? lists : [text]).some((list) =>
    list.split(",").some(
      (part) =>
        part
          .trim()
          .replace(/^["']|["']$/g, "")
          .trim()
          .toLowerCase() === want
    )
  );
}

function stylesMention(styles: StyleMap, family: string): boolean {
  for (const byState of Object.values(styles.breakpoints)) {
    for (const declarations of Object.values(byState)) {
      const value = declarations["font-family"];
      if (value && mentionsFamily(value, family)) return true;
    }
  }
  return styles.raw !== undefined && mentionsFamily(styles.raw, family);
}

/** Elements in the tree whose styles name the family. */
export function countFamilyInTree(root: ElementNode, family: string): number {
  let count = 0;
  walkElements(root, (node) => {
    const custom = node.customCss ? { breakpoints: {}, raw: node.customCss } : null;
    if (stylesMention(node.styles, family) || (custom && stylesMention(custom, family))) count += 1;
  });
  return count;
}

export const countFamilyInStyles = (styles: StyleMap, family: string): number =>
  stylesMention(styles, family) ? 1 : 0;
