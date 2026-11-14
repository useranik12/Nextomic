import { createHash } from "node:crypto";
import {
  FONT_MIME,
  ICON_CATALOG,
  IconImportError,
  glyphMap,
  iconKeySchema,
  iconLibrarySchema,
  normalizeIconifySet,
  parseFontello,
  parseIcoMoon,
  parseIconFontCss,
  slugIconName,
  sniffFontFormat,
  svgToIcon,
  type IconFontFile,
  type IconLibrary,
  type IconSample,
  type IconSource,
  type SvgIcon
} from "@nextomic/schema";
import { unzipSync } from "fflate";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/storage";
import { IconError, iconFontKey, iconSetKey } from "./icons";

// Custom icon libraries. Uploaded files are read, never served or executed: icon fonts keep only
// their font files and a glyph map (the uploaded CSS is parsed and dropped, the builder writes its
// own), SVG files are sanitized, Iconify JSON is validated and every icon in it is sanitized.

export const MAX_SVG_FILES = 1000;
export const MAX_SVG_BYTES = 200_000;
export const MAX_SVG_TOTAL = 20_000_000;
export const MAX_FONT_BYTES = 2_000_000;
export const MAX_FONT_FILES = 4;
export const MAX_META_BYTES = 5_000_000;
export const MAX_JSON_SET_BYTES = 28_000_000;

export const MAX_ZIP_ENTRIES = 2000;
export const MAX_ZIP_TOTAL = 60_000_000;
const ZIP_KEEP = new Set(["svg", "json", "css", "woff2", "woff", "ttf", "otf"]);

export const iconUploadMetaSchema = z.object({
  name: z.string().trim().min(1, "Give the library a name.").max(60),
  kind: z.enum(["font", "svg", "iconify-json"]),
  /** SVG only: keep the files' own colors instead of recoloring to the text color. */
  keepColors: z.boolean().default(false),
  license: z.string().trim().max(80).default(""),
  rights: z.literal(true, {
    errorMap: () => ({ message: "Confirm you have the right to use and distribute these icons." })
  }),
  /** Keys of the libraries the project already has (including unsaved ones). */
  takenKeys: z.array(iconKeySchema).max(100).default([])
});
export type IconUploadMeta = z.infer<typeof iconUploadMetaSchema>;

export interface UploadFile {
  name: string;
  data: Uint8Array;
}
export interface UploadResult {
  library: IconLibrary;
  /** Files or icons that were left out, with the reason (at most 20 lines). */
  skipped: string[];
}

const sha256 = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");
const ext = (name: string): string => /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
const baseName = (name: string): string => name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
const decode = (data: Uint8Array): string => new TextDecoder().decode(data);

/** A library key from its name: unique among the catalog, the project's libraries and itself. */
function libraryKey(name: string, taken: readonly string[]): string {
  const key = slugIconName(name).slice(0, 40).replace(/-+$/, "");
  if (!iconKeySchema.safeParse(key).success)
    throw new IconError("Use letters or digits in the library name.");
  if (ICON_CATALOG.some((c) => c.prefix === key) || taken.includes(key))
    throw new IconError(`A library called "${key}" exists. Pick another name.`);
  return key;
}

/** Up to four evenly spaced items, so a preview shows variety. */
function spread<T>(items: readonly T[]): T[] {
  const n = Math.min(4, items.length);
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)] as T);
}

async function storeContentFile(
  projectId: string,
  key: string,
  data: Uint8Array,
  suffix: string,
  contentType: string
): Promise<{ file: string; sha: string }> {
  const sha = sha256(data);
  const file = `${key}-${sha.slice(0, 8)}.${suffix}`;
  const storageKey = suffix === "json" ? iconSetKey(projectId, file) : iconFontKey(projectId, file);
  await getStorageAdapter().put({ key: storageKey, data, contentType });
  return { file, sha };
}

function describe(
  meta: IconUploadMeta,
  key: string,
  source: IconSource,
  extra: Partial<IconLibrary> & Pick<IconLibrary, "count" | "bytes" | "sha256" | "file">
): IconLibrary {
  return iconLibrarySchema.parse({
    key,
    name: meta.name,
    source,
    version: "",
    license: meta.license,
    mode: "svg",
    enabled: true,
    installedAt: new Date().toISOString(),
    ...extra
  });
}

// ---- Zip files ----------------------------------------------------------------------------------

const isZip = (data: Uint8Array): boolean =>
  data[0] === 0x50 && data[1] === 0x4b && data[2] === 3 && data[3] === 4;

/**
 * Replaces each uploaded .zip by the supported files inside it (svg, json, css and font files; folder
 * names are dropped, hidden and __MACOSX entries are skipped). Declared sizes are checked before
 * anything is inflated, so a small zip cannot expand into memory: at most 2000 files, 28 MB each,
 * 60 MB together. What comes out then goes through the same checks as files chosen one by one.
 */
export function expandZips(files: readonly UploadFile[]): UploadFile[] {
  const out: UploadFile[] = [];
  let entries = 0;
  let total = 0;
  for (const file of files) {
    if (ext(file.name) !== "zip") {
      out.push(file);
      continue;
    }
    if (!isZip(file.data)) throw new IconError(`${file.name} is not a valid zip file.`);
    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(file.data, {
        filter: (info) => {
          const base = info.name.replace(/^.*\//, "");
          if (info.name.endsWith("/") || base.startsWith(".") || info.name.startsWith("__MACOSX/"))
            return false;
          if (!ZIP_KEEP.has(ext(base))) return false;
          entries += 1;
          total += info.originalSize;
          if (entries > MAX_ZIP_ENTRIES) throw new IconError("This zip has too many files.");
          if (info.originalSize > MAX_JSON_SET_BYTES || total > MAX_ZIP_TOTAL)
            throw new IconError("This zip is larger than 60 MB unpacked.");
          return true;
        }
      });
    } catch (error) {
      if (error instanceof IconError) throw error;
      throw new IconError(`${file.name} could not be opened as a zip file.`);
    }
    for (const [path, data] of Object.entries(unzipped)) {
      out.push({ name: path.replace(/^.*\//, ""), data });
    }
  }
  return out;
}

// ---- SVG files ---------------------------------------------------------------------------------

async function importSvgFiles(
  projectId: string,
  meta: IconUploadMeta,
  key: string,
  files: readonly UploadFile[]
): Promise<UploadResult> {
  if (files.length > MAX_SVG_FILES)
    throw new IconError(`Upload up to ${MAX_SVG_FILES} SVG files at a time.`);
  if (files.reduce((n, f) => n + f.data.length, 0) > MAX_SVG_TOTAL)
    throw new IconError("These files are larger than 20 MB together.");
  const skipped: string[] = [];
  const icons: Record<string, SvgIcon> = {};
  for (const file of files) {
    if (ext(file.name) !== "svg") {
      skipped.push(`${file.name}: not an SVG file`);
      continue;
    }
    if (file.data.length > MAX_SVG_BYTES) {
      skipped.push(`${file.name}: larger than 200 KB`);
      continue;
    }
    try {
      const icon = svgToIcon(decode(file.data), meta.keepColors);
      const base = slugIconName(baseName(file.name)) || "icon";
      let name = base;
      for (let n = 2; name in icons; n++) name = `${base}-${n}`;
      icons[name] = icon;
    } catch (error) {
      if (!(error instanceof IconImportError)) throw error;
      skipped.push(`${file.name}: ${error.message}`);
    }
  }
  const names = Object.keys(icons);
  if (names.length === 0) throw new IconError(skipped[0] ?? "No SVG files were chosen.");
  const data = new TextEncoder().encode(
    JSON.stringify({ prefix: key, width: 24, height: 24, icons })
  );
  const { file, sha } = await storeContentFile(projectId, key, data, "json", "application/json");
  const samples: IconSample[] = spread(names).map((name) => ({
    name,
    ...(icons[name] as SvgIcon)
  }));
  return {
    library: describe(meta, key, "upload-svg", {
      count: names.length,
      bytes: data.length,
      sha256: sha,
      file,
      samples,
      palette: meta.keepColors,
      animated: names.some((n) => icons[n]!.body.includes("<animate"))
    }),
    skipped: skipped.slice(0, 20)
  };
}

// ---- Iconify JSON ------------------------------------------------------------------------------

async function importIconifyJson(
  projectId: string,
  meta: IconUploadMeta,
  key: string,
  files: readonly UploadFile[]
): Promise<UploadResult> {
  const file = files.find((f) => ext(f.name) === "json");
  if (!file) throw new IconError("Choose the Iconify .json file.");
  if (file.data.length > MAX_JSON_SET_BYTES) throw new IconError("This file is larger than 28 MB.");
  let json: unknown;
  try {
    json = JSON.parse(decode(file.data));
  } catch {
    throw new IconError("This file is not valid JSON.");
  }
  const { set, skipped } = normalizeIconifySet(json, key);
  const data = new TextEncoder().encode(JSON.stringify(set));
  const stored = await storeContentFile(projectId, key, data, "json", "application/json");
  const names = Object.keys(set.icons);
  const samples: IconSample[] = spread(names).map((name) => {
    const icon = set.icons[name]!;
    return {
      name,
      body: icon.body,
      width: icon.width ?? set.width ?? 16,
      height: icon.height ?? set.height ?? 16,
      ...(icon.left !== undefined ? { left: icon.left } : {}),
      ...(icon.top !== undefined ? { top: icon.top } : {})
    };
  });
  return {
    library: describe(meta, key, "iconify-json", {
      count: names.length,
      bytes: data.length,
      sha256: stored.sha,
      file: stored.file,
      samples,
      animated: names.some((n) => set.icons[n]!.body.includes("<animate"))
    }),
    skipped:
      skipped > 0
        ? [`${skipped} icons or aliases were left out (invalid name or unsafe markup).`]
        : []
  };
}

// ---- Icon fonts --------------------------------------------------------------------------------

const NOT_FOUND_GLYPHS =
  "Add the file that lists the icons: selection.json (IcoMoon), config.json (Fontello) or the CSS file that came with the font.";

function readJson(file: UploadFile, what: string): unknown {
  if (file.data.length > MAX_META_BYTES) throw new IconError(`${what} is larger than 5 MB.`);
  try {
    return JSON.parse(decode(file.data));
  } catch {
    throw new IconError(`${what} is not valid JSON.`);
  }
}

/** Glyph names and codepoints from whichever metadata file came with the font. */
function readGlyphs(files: readonly UploadFile[]): {
  source: IconSource;
  map: Record<string, string>;
} {
  const named = (n: string) =>
    files.find((f) => baseName(f.name).toLowerCase() === n && ext(f.name) === "json");
  const css = files.find((f) => ext(f.name) === "css");
  const icomoon = named("selection");
  const fontello = named("config");
  const [source, glyphs] = icomoon
    ? (["icomoon", parseIcoMoon(readJson(icomoon, "selection.json"))] as const)
    : fontello
      ? (["fontello", parseFontello(readJson(fontello, "config.json"))] as const)
      : css
        ? (["upload-font", parseIconFontCss(decode(css.data).slice(0, MAX_META_BYTES))] as const)
        : (() => {
            throw new IconError(NOT_FOUND_GLYPHS);
          })();
  const map = glyphMap(glyphs);
  if (Object.keys(map).length === 0) throw new IconError("No icons were found in that file.");
  return { source, map };
}

async function importIconFont(
  projectId: string,
  meta: IconUploadMeta,
  key: string,
  files: readonly UploadFile[]
): Promise<UploadResult> {
  const fonts = files.filter((f) => ["woff2", "woff", "ttf", "otf"].includes(ext(f.name)));
  if (fonts.length === 0) throw new IconError("Add the font file (woff2, woff, ttf or otf).");
  if (fonts.length > MAX_FONT_FILES) throw new IconError("Add up to four font files.");
  const formats = new Set<string>();
  for (const font of fonts) {
    if (font.data.length > MAX_FONT_BYTES) throw new IconError(`${font.name} is larger than 2 MB.`);
    const format = sniffFontFormat(font.data);
    if (!format) throw new IconError(`${font.name} is not a valid font file.`);
    if (formats.has(format))
      throw new IconError(`Two files are ${format}. Add one file per format.`);
    formats.add(format);
  }
  const { source, map } = readGlyphs(files);
  const fontFiles: IconFontFile[] = [];
  let bytes = 0;
  for (const font of fonts) {
    const format = sniffFontFormat(font.data)!;
    const stored = await storeContentFile(projectId, key, font.data, format, FONT_MIME[format]);
    fontFiles.push({ file: stored.file, format, bytes: font.data.length, sha256: stored.sha });
    bytes += font.data.length;
  }
  const data = new TextEncoder().encode(JSON.stringify({ prefix: key, glyphs: map }));
  const stored = await storeContentFile(projectId, key, data, "json", "application/json");
  const names = Object.keys(map);
  return {
    library: describe(meta, key, source, {
      mode: "font",
      count: names.length,
      bytes: bytes + data.length,
      sha256: stored.sha,
      file: stored.file,
      fontFiles,
      glyphSamples: spread(names).map((n) => map[n]!)
    }),
    skipped: []
  };
}

/** Imports an uploaded icon library of any kind and stores it in the project. */
export async function importIconUpload(
  projectId: string,
  rawMeta: unknown,
  files: readonly UploadFile[]
): Promise<UploadResult> {
  const meta = iconUploadMetaSchema.parse(rawMeta);
  const key = libraryKey(meta.name, meta.takenKeys);
  if (files.length === 0) throw new IconError("Choose the files to upload.");
  const expanded = expandZips(files);
  if (expanded.length === 0)
    throw new IconError("The zip holds no supported files (svg, json, css or font files).");
  try {
    if (meta.kind === "svg") return await importSvgFiles(projectId, meta, key, expanded);
    if (meta.kind === "iconify-json")
      return await importIconifyJson(projectId, meta, key, expanded);
    return await importIconFont(projectId, meta, key, expanded);
  } catch (error) {
    if (error instanceof IconImportError) throw new IconError(error.message);
    throw error;
  }
}
