import { createHash, randomBytes } from "node:crypto";
import {
  FONT_MIME,
  FONT_FAMILY_PATTERN,
  fontFileSchema,
  fontSchema,
  slugifyFontId,
  sortFontFiles,
  sniffFontFormat,
  type FontFile,
  type ProjectFont
} from "@nextomic/schema";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/storage";

// Font import. Everything fetched from the network goes through `fetchAllowed`: https only, a fixed
// host allowlist, no redirects, a timeout and a size cap (docs/integrations.md SSRF rules).
// Google Fonts are fetched through Fontsource, so no request ever goes to Google and built sites
// load the files from their own origin.

const API = "https://api.fontsource.org/v1";
const FILE_HOST = "cdn.jsdelivr.net";
const ALLOWED_HOSTS = new Set(["api.fontsource.org", FILE_HOST]);
const MAX_FILE_BYTES = 2_000_000;
const MAX_JSON_BYTES = 8_000_000;
const TIMEOUT_MS = 20_000;
const CATALOG_TTL_MS = 60 * 60 * 1000;

export class FontError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FontError";
  }
}

async function fetchAllowed(url: string, maxBytes: number): Promise<Uint8Array> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new FontError("That address is not an allowed font source.");
  }
  let response: Response;
  try {
    response = await fetch(parsed, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new FontError("Could not reach the font source. Try again in a moment.");
  }
  if (!response.ok) throw new FontError(`The font source answered ${response.status}.`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new FontError("A font file is larger than the allowed size.");
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length > maxBytes) throw new FontError("A font file is larger than the allowed size.");
  return data;
}

async function fetchJson<T>(url: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const data = await fetchAllowed(url, MAX_JSON_BYTES);
  try {
    return schema.parse(JSON.parse(new TextDecoder().decode(data)));
  } catch {
    throw new FontError("The font source sent data this builder does not understand.");
  }
}

// ---- Catalog -----------------------------------------------------------------------------------

const categorySchema = z.string().transform((c): ProjectFont["category"] => {
  if (c === "sans-serif" || c === "serif" || c === "monospace" || c === "display") return c;
  return c === "handwriting" ? "handwriting" : "other";
});

const catalogEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  family: z.string().regex(FONT_FAMILY_PATTERN).max(64),
  subsets: z.array(z.string().max(32)),
  weights: z.array(z.number().int()),
  styles: z.array(z.string()),
  defSubset: z.string().default("latin"),
  variable: z.boolean(),
  category: categorySchema,
  license: z.string().max(80).default(""),
  type: z.string().default("google")
});
export type CatalogFont = z.infer<typeof catalogEntrySchema>;

let catalog: { at: number; fonts: CatalogFont[] } | null = null;

async function loadCatalog(): Promise<CatalogFont[]> {
  if (catalog && Date.now() - catalog.at < CATALOG_TTL_MS) return catalog.fonts;
  const raw = await fetchAllowed(`${API}/fonts?type=google`, MAX_JSON_BYTES);
  let list: unknown;
  try {
    list = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new FontError("The font catalog could not be read.");
  }
  if (!Array.isArray(list)) throw new FontError("The font catalog could not be read.");
  // Entries that do not parse (odd names) are left out rather than failing the whole catalog.
  const fonts = list.flatMap((entry) => {
    const parsed = catalogEntrySchema.safeParse(entry);
    return parsed.success && parsed.data.type === "google" ? [parsed.data] : [];
  });
  catalog = { at: Date.now(), fonts };
  return fonts;
}

export const FONT_SEARCH_PAGE = 30;

export async function searchFonts(input: {
  query: string;
  category: string;
  variableOnly: boolean;
  offset: number;
}): Promise<{ fonts: CatalogFont[]; total: number }> {
  const all = await loadCatalog();
  const q = input.query.trim().toLowerCase();
  const matches = all.filter(
    (f) =>
      (!q || f.family.toLowerCase().includes(q)) &&
      (input.category === "all" || f.category === input.category) &&
      (!input.variableOnly || f.variable)
  );
  return {
    fonts: matches.slice(input.offset, input.offset + FONT_SEARCH_PAGE),
    total: matches.length
  };
}

// ---- Install from the catalog ------------------------------------------------------------------

const detailSchema = z.object({
  npmVersion: z.string().regex(/^[0-9A-Za-z.\-+]+$/),
  unicodeRange: z.record(z.string(), z.string()).default({}),
  variants: z.record(
    z.string(),
    z.record(
      z.string(),
      z.record(z.string(), z.object({ url: z.object({ woff2: z.string().optional() }) }))
    )
  )
});

const axesSchema = z.object({
  axes: z.object({
    wght: z.object({ min: z.coerce.number(), max: z.coerce.number() }).optional()
  })
});

export const installFontInputSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(64),
  weights: z.array(z.number().int().min(1).max(1000)).max(20),
  italic: z.boolean(),
  subsets: z.array(z.string().trim().min(1).max(32)).min(1).max(12),
  variable: z.boolean(),
  /** Variable fonts: the weights to declare (inside the font's own range). */
  range: z.tuple([z.number().int().min(1).max(1000), z.number().int().min(1).max(1000)]).optional()
});
export type InstallFontInput = z.infer<typeof installFontInputSchema>;

const fileSlug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const sha256 = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");

interface Planned {
  url: string;
  name: string;
  weight: number;
  weightMax?: number;
  style: "normal" | "italic";
  subset: string;
  unicodeRange?: string;
}

async function inParallel<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await work(items[index] as T);
    }
  });
  await Promise.all(runners);
  return out;
}

async function storeFiles(
  projectId: string,
  fontId: string,
  files: {
    name: string;
    data: Uint8Array;
    meta: Omit<FontFile, "file" | "bytes" | "sha256" | "format">;
  }[]
): Promise<FontFile[]> {
  const storage = getStorageAdapter();
  const result: FontFile[] = [];
  for (const file of files) {
    const format = sniffFontFormat(file.data);
    if (!format || !file.name.endsWith(`.${format}`)) {
      throw new FontError(`${file.name} is not a valid font file.`);
    }
    await storage.put({
      key: `fonts/${projectId}/${fontId}/${file.name}`,
      data: file.data,
      contentType: FONT_MIME[format]
    });
    result.push(
      fontFileSchema.parse({
        ...file.meta,
        file: file.name,
        format,
        bytes: file.data.length,
        sha256: sha256(file.data)
      })
    );
  }
  return result;
}

/** The weight range a catalog font really offers as one variable file, or null when it has none. */
export async function fontWeightAxis(id: string): Promise<{ min: number; max: number } | null> {
  const entry = (await loadCatalog()).find((f) => f.id === id);
  if (!entry || !entry.variable) return null;
  try {
    const wght = (await fetchJson(`${API}/variable/${entry.id}`, axesSchema)).axes.wght;
    return wght ? { min: Math.round(wght.min), max: Math.round(wght.max) } : null;
  } catch {
    return null;
  }
}

/** Downloads the chosen weights, styles and subsets of a catalog font into project storage. */
export async function installCatalogFont(
  projectId: string,
  input: InstallFontInput
): Promise<ProjectFont> {
  const entry = (await loadCatalog()).find((f) => f.id === input.id);
  if (!entry) throw new FontError("That font is not in the catalog.");
  const subsets = input.subsets.filter((s) => entry.subsets.includes(s));
  if (subsets.length === 0) throw new FontError("Pick at least one subset.");
  const styles = (input.italic ? ["normal", "italic"] : ["normal"]).filter((s) =>
    entry.styles.includes(s)
  ) as ("normal" | "italic")[];

  const detail = await fetchJson(`${API}/fonts/${entry.id}`, detailSchema);
  const planned: Planned[] = [];

  if (input.variable) {
    const axes = await fetchJson(`${API}/variable/${entry.id}`, axesSchema);
    const wght = axes.axes.wght;
    if (!entry.variable || !wght) throw new FontError("This font has no variable weight axis.");
    const low = Math.max(Math.round(wght.min), Math.min(...(input.range ?? [wght.min, wght.max])));
    const high = Math.min(Math.round(wght.max), Math.max(...(input.range ?? [wght.min, wght.max])));
    if (low > high) throw new FontError("Pick a weight range inside the font's range.");
    for (const style of styles)
      for (const subset of subsets)
        planned.push({
          url: `https://${FILE_HOST}/fontsource/fonts/${entry.id}:vf@${detail.npmVersion}/${subset}-wght-${style}.woff2`,
          name: `${fileSlug(subset)}-wght-${style}.woff2`,
          weight: low,
          ...(high > low ? { weightMax: high } : {}),
          style,
          subset,
          unicodeRange: detail.unicodeRange[subset]
        });
  } else {
    const weights = input.weights.filter((w) => entry.weights.includes(w));
    if (weights.length === 0) throw new FontError("Pick at least one weight.");
    for (const weight of weights)
      for (const style of styles)
        for (const subset of subsets) {
          const url = detail.variants[String(weight)]?.[style]?.[subset]?.url.woff2;
          if (!url) continue;
          planned.push({
            url,
            name: `${fileSlug(subset)}-${weight}-${style}.woff2`,
            weight,
            style,
            subset,
            unicodeRange: detail.unicodeRange[subset]
          });
        }
  }
  if (planned.length === 0) throw new FontError("No files match that selection.");
  if (planned.length > 60)
    throw new FontError("That is more than 60 files. Pick fewer weights or subsets.");

  const downloaded = await inParallel(planned, 6, async (p) => ({
    name: p.name,
    data: await fetchAllowed(p.url, MAX_FILE_BYTES),
    meta: {
      weight: p.weight,
      weightMax: p.weightMax,
      style: p.style,
      subset: p.subset,
      unicodeRange: p.unicodeRange
    }
  }));
  const files = await storeFiles(projectId, entry.id, downloaded);

  return fontSchema.parse({
    id: entry.id,
    family: entry.family,
    source: "google",
    sourceNote: `Fontsource ${entry.id}@${detail.npmVersion}`,
    category: entry.category,
    license: entry.license,
    active: true,
    preload: false,
    display: "swap",
    files: sortFontFiles(files)
  });
}

// ---- Upload ------------------------------------------------------------------------------------

const MAX_UPLOAD_FILES = 12;

export const uploadMetaSchema = z.object({
  family: z
    .string()
    .trim()
    .regex(FONT_FAMILY_PATTERN, "Use letters, digits, spaces and - _ . + only.")
    .max(64),
  category: fontSchema.shape.category,
  license: z.string().trim().max(80),
  rights: z.literal(true, {
    errorMap: () => ({ message: "Confirm you have the right to use and distribute this font." })
  }),
  files: z
    .array(
      z.object({
        weight: z.number().int().min(1).max(1000),
        weightMax: z.number().int().min(1).max(1000).optional(),
        style: z.enum(["normal", "italic"])
      })
    )
    .min(1)
    .max(MAX_UPLOAD_FILES)
});
export type UploadMeta = z.infer<typeof uploadMetaSchema>;

/** Stores uploaded font files. Format comes from the file's bytes, never from its name or type. */
export async function storeUploadedFont(
  projectId: string,
  meta: UploadMeta,
  blobs: { data: Uint8Array }[]
): Promise<ProjectFont> {
  if (blobs.length !== meta.files.length)
    throw new FontError("Each file needs its weight and style.");
  const id = slugifyFontId(meta.family);
  if (!id) throw new FontError("Give the font a name.");
  const seen = new Set<string>();
  const files = blobs.map((blob, i) => {
    if (blob.data.length > MAX_FILE_BYTES) throw new FontError("A font file is larger than 2 MB.");
    const format = sniffFontFormat(blob.data);
    if (!format) throw new FontError("Only woff2, woff, ttf and otf font files are accepted.");
    const m = meta.files[i] as UploadMeta["files"][number];
    const key = `${m.weight}-${m.weightMax ?? ""}-${m.style}`;
    if (seen.has(key)) throw new FontError("Two files have the same weight and style.");
    seen.add(key);
    const range = m.weightMax ? `${m.weight}-${m.weightMax}` : String(m.weight);
    return {
      // A random part keeps a replaced file from overwriting the one another face still points at.
      name: `${range}-${m.style}-${randomBytes(3).toString("hex")}.${format}`,
      data: blob.data,
      meta: { weight: m.weight, weightMax: m.weightMax, style: m.style, subset: "latin" }
    };
  });
  const stored = await storeFiles(projectId, id, files);
  return fontSchema.parse({
    id,
    family: meta.family,
    source: "upload",
    sourceNote: "Uploaded",
    category: meta.category,
    license: meta.license,
    active: true,
    preload: false,
    display: "swap",
    files: sortFontFiles(stored)
  });
}
