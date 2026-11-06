import { parse } from "postcss";
import { z } from "zod";

// Custom CSS files (docs/design-system.md section 8): ordered per project, each on or off, global or
// limited to some pages. A file that does not parse is skipped when the page is built, so a syntax
// error never breaks a page.

export const CSS_FILE_MAX_BYTES = 200_000;
export const CSS_FILE_MAX_COUNT = 50;

export const cssFileSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(64),
  css: z.string().max(CSS_FILE_MAX_BYTES).default(""),
  enabled: z.boolean().default(true),
  scope: z.enum(["global", "pages"]).default("global"),
  // Pages the file applies to when the scope is "pages".
  pageIds: z.array(z.string().max(64)).max(500).default([]),
  // Remove comments and whitespace in the published site (the editor always shows the source).
  minify: z.boolean().default(true)
});
export type CssFile = z.infer<typeof cssFileSchema>;

export const cssFileListSchema = z.array(cssFileSchema).max(CSS_FILE_MAX_COUNT);

export type CssFileCheck = { ok: true } | { ok: false; error: string; line: number | null };

/** Parses the CSS. It must be valid and must not be able to close the <style> tag it is placed in. */
export function validateCssFile(css: string): CssFileCheck {
  if (/<\/style/i.test(css)) {
    return { ok: false, error: "The CSS cannot contain </style>.", line: null };
  }
  try {
    parse(css);
    return { ok: true };
  } catch (error) {
    const e = error as { reason?: string; line?: number };
    return { ok: false, error: e.reason ?? "The CSS could not be read.", line: e.line ?? null };
  }
}

/** Comments and extra whitespace removed; the rules themselves are not changed. */
export function minifyCss(css: string): string {
  const root = parse(css);
  root.walkComments((c) => void c.remove());
  root.walk((node) => {
    if (node.type === "decl") node.raws = { before: "", between: ":" };
    else if (node.type === "rule")
      node.raws = { before: "", between: "", after: "", semicolon: false };
    else if (node.type === "atrule") {
      node.raws = { before: "", between: "", after: "", afterName: " ", semicolon: false };
    }
  });
  root.raws = { after: "" };
  return root.toString().trim();
}

/** The files that apply to a page: enabled, in scope and valid, in their order. */
export function cssFilesFor(files: readonly CssFile[], pageId: string | null): CssFile[] {
  return files.filter(
    (f) =>
      f.enabled &&
      (f.scope === "global" || (pageId !== null && f.pageIds.includes(pageId))) &&
      validateCssFile(f.css).ok
  );
}

/** One block of CSS for a page, in file order. `minify` is for the published site. */
export function customCssFor(
  files: readonly CssFile[],
  pageId: string | null,
  options: { minify?: boolean } = {}
): string {
  return cssFilesFor(files, pageId)
    .map((f) => (options.minify && f.minify ? minifyCss(f.css) : f.css))
    .join("\n");
}
