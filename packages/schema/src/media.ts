import { z } from "zod";

// Media library (docs/ui-reference.md 4.6). Files are identified from their own bytes, never from
// the name or the type the browser declared. Everything here is pure so the server, the editor and
// the tests share one definition.

export const MEDIA_KINDS = ["image", "svg", "video", "audio", "other"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface MediaFormat {
  /** Lowercase extension the stored file name ends with. */
  ext: string;
  mime: string;
  kind: MediaKind;
}

/** Upload size caps per kind, in bytes. */
export const MEDIA_MAX_BYTES: Record<MediaKind, number> = {
  image: 25 * 1024 * 1024,
  svg: 2 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  other: 25 * 1024 * 1024
};
/** The largest any upload may be; the request body is cut off here before a kind is known. */
export const MEDIA_MAX_UPLOAD_BYTES = Math.max(...Object.values(MEDIA_MAX_BYTES));

/** "Large files" in the library: bigger than this. */
export const MEDIA_LARGE_BYTES = 1024 * 1024;

const at = (data: Uint8Array, offset: number, bytes: readonly number[]) =>
  bytes.every((b, i) => data[offset + i] === b);
const ascii = (data: Uint8Array, offset: number, text: string) =>
  at(
    data,
    offset,
    [...text].map((c) => c.charCodeAt(0))
  );

const FORMATS = {
  png: { ext: "png", mime: "image/png", kind: "image" },
  jpg: { ext: "jpg", mime: "image/jpeg", kind: "image" },
  gif: { ext: "gif", mime: "image/gif", kind: "image" },
  webp: { ext: "webp", mime: "image/webp", kind: "image" },
  avif: { ext: "avif", mime: "image/avif", kind: "image" },
  svg: { ext: "svg", mime: "image/svg+xml", kind: "svg" },
  mp4: { ext: "mp4", mime: "video/mp4", kind: "video" },
  mov: { ext: "mov", mime: "video/quicktime", kind: "video" },
  webm: { ext: "webm", mime: "video/webm", kind: "video" },
  mp3: { ext: "mp3", mime: "audio/mpeg", kind: "audio" },
  wav: { ext: "wav", mime: "audio/wav", kind: "audio" },
  ogg: { ext: "ogg", mime: "audio/ogg", kind: "audio" },
  m4a: { ext: "m4a", mime: "audio/mp4", kind: "audio" },
  pdf: { ext: "pdf", mime: "application/pdf", kind: "other" }
} as const satisfies Record<string, MediaFormat>;

export type MediaFormatId = keyof typeof FORMATS;

const BOM = new RegExp("^" + String.fromCharCode(0xfeff));

/** Text of an SVG's first bytes (BOM and whitespace skipped), lowercased, for the sniff. */
function svgHead(data: Uint8Array): string {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(data.subarray(0, 2048));
  return head.replace(BOM, "").trimStart().toLowerCase();
}

/** Looks for `<svg` as the root, after an optional XML declaration, comments and doctype. */
export function looksLikeSvg(data: Uint8Array): boolean {
  const head = svgHead(data);
  if (head.startsWith("<svg")) return true;
  if (!head.startsWith("<?xml") && !head.startsWith("<!--") && !head.startsWith("<!doctype svg"))
    return false;
  return /<svg[\s/>]/.test(head);
}

/**
 * The format read from the file's own bytes. HTML, scripts and other text never match, so they
 * cannot be stored. ISO media (mp4, mov, m4a) share a `ftyp` box; its brand tells them apart.
 */
export function sniffMedia(data: Uint8Array): MediaFormat | null {
  if (data.length < 12) return looksLikeSvg(data) ? FORMATS.svg : null;
  if (at(data, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return FORMATS.png;
  if (at(data, 0, [0xff, 0xd8, 0xff])) return FORMATS.jpg;
  if (ascii(data, 0, "GIF87a") || ascii(data, 0, "GIF89a")) return FORMATS.gif;
  if (ascii(data, 0, "RIFF") && ascii(data, 8, "WEBP")) return FORMATS.webp;
  if (ascii(data, 0, "RIFF") && ascii(data, 8, "WAVE")) return FORMATS.wav;
  if (ascii(data, 0, "OggS")) return FORMATS.ogg;
  if (ascii(data, 0, "%PDF-")) return FORMATS.pdf;
  if (at(data, 0, [0x1a, 0x45, 0xdf, 0xa3])) return FORMATS.webm;
  if (ascii(data, 0, "ID3")) return FORMATS.mp3;
  if (data[0] === 0xff && ((data[1] ?? 0) & 0xe0) === 0xe0 && ((data[1] ?? 0) & 0x06) !== 0)
    return FORMATS.mp3;
  if (ascii(data, 4, "ftyp")) {
    const brand = String.fromCharCode(...data.subarray(8, 12));
    if (brand === "avif" || brand === "avis") return FORMATS.avif;
    if (brand === "qt  ") return FORMATS.mov;
    if (brand === "M4A " || brand === "M4B ") return FORMATS.m4a;
    if (/^(isom|iso2|iso4|iso5|iso6|mp41|mp42|avc1|dash|MSNV|M4V |3gp.)$/.test(brand))
      return FORMATS.mp4;
    return null;
  }
  return looksLikeSvg(data) ? FORMATS.svg : null;
}

/** Why a file was refused, in words the person uploading can act on. */
export function refuseReason(data: Uint8Array): string {
  const head = svgHead(data);
  if (/^(<!doctype html|<html|<head|<body|<script)/.test(head))
    return "HTML and script files cannot be uploaded.";
  if (head.startsWith("<?xml") || head.startsWith("<"))
    return "This file is not an image, video, audio file or PDF the library accepts.";
  return "This file type is not supported. Use an image, SVG, video, audio file or PDF.";
}

/** Stored file name: a safe slug of the original name with the extension the bytes prove. */
export function mediaFileName(original: string, ext: string): string {
  const base = original
    .replace(/\.[A-Za-z0-9]{1,8}$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "file"}.${ext}`;
}

/** Name shown in the library: the original file name without the extension. */
export function mediaTitleFromName(original: string): string {
  return (
    original
      .replace(/\.[A-Za-z0-9]{1,8}$/, "")
      .replace(/[\r\n\t]+/g, " ")
      .trim()
      .slice(0, 120) || "Untitled"
  );
}

export const MEDIA_ID = /^[a-f0-9]{24}$/;
export const MEDIA_FILE = /^[a-z0-9][a-z0-9._-]{0,80}\.[a-z0-9]{2,5}$/;
export const MEDIA_SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;

/** The path stored in element props: stable for the asset's life, even after Replace file. */
export function mediaPath(projectId: string, assetId: string, file: string): string {
  return `/media/${projectId}/${assetId}/${file}`;
}

/** The asset id inside a stored media path, or null when the text is not a media path. */
export function mediaIdFromPath(path: string): string | null {
  const m = /^\/media\/[A-Za-z0-9_-]{1,100}\/([a-f0-9]{24})\/[^/?#]+(?:[?#].*)?$/.exec(path);
  return m?.[1] ?? null;
}

export const mediaTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(32)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u, "Tags use letters, numbers, spaces, - and _.");
export const mediaTagsSchema = z
  .array(mediaTagSchema)
  .max(20)
  .transform((tags) => [...new Set(tags)]);

export const mediaFolderNameSchema = z
  .string()
  .trim()
  .min(1, "Name the folder.")
  .max(60, "Folder names can be up to 60 characters.")
  .refine(
    (n) => ![...n].some((c) => c === "/" || c === "\\" || c.charCodeAt(0) < 32),
    "A folder name cannot contain / or \\."
  );

export const mediaEditSchema = z
  .object({
    title: z.string().trim().max(120),
    alt: z.string().trim().max(300),
    caption: z.string().trim().max(500),
    tags: mediaTagsSchema,
    folderId: z.string().min(1).max(100).nullable()
  })
  .partial();
export type MediaEdit = z.infer<typeof mediaEditSchema>;

export const MEDIA_FILTERS = [
  "all",
  "missing-alt",
  "missing-title",
  "untagged",
  "large",
  "replaced",
  "trash"
] as const;
export type MediaFilter = (typeof MEDIA_FILTERS)[number];
export const MEDIA_TYPE_TABS = ["all", "image", "svg", "video", "other"] as const;
export type MediaTypeTab = (typeof MEDIA_TYPE_TABS)[number];
export const MEDIA_SORTS = ["newest", "oldest", "name", "size"] as const;
export type MediaSort = (typeof MEDIA_SORTS)[number];

export const MEDIA_PAGE_SIZE = 60;

export const mediaQuerySchema = z.object({
  filter: z.enum(MEDIA_FILTERS).default("all"),
  folderId: z.string().min(1).max(100).nullable().default(null),
  type: z.enum(MEDIA_TYPE_TABS).default("all"),
  sort: z.enum(MEDIA_SORTS).default("newest"),
  search: z.string().trim().max(80).default(""),
  offset: z.number().int().min(0).max(100_000).default(0)
});
export type MediaQuery = z.infer<typeof mediaQuerySchema>;

/** Kinds that need alt text when an image element shows them. */
export const MEDIA_NEEDS_ALT: ReadonlySet<MediaKind> = new Set(["image", "svg"]);

export interface MediaAsset {
  id: string;
  folderId: string | null;
  /** Empty until named; show `originalName` then. */
  title: string;
  originalName: string;
  fileName: string;
  kind: MediaKind;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  tags: string[];
  /** Public path to store in element props. */
  path: string;
  hash: string;
  replacedAt: string | null;
  trashedAt: string | null;
  createdAt: string;
}

export interface MediaFolder {
  id: string;
  name: string;
}

export interface MediaCounts {
  all: number;
  missingAlt: number;
  missingTitle: number;
  untagged: number;
  large: number;
  replaced: number;
  trash: number;
  byFolder: Record<string, number>;
}

export interface MediaUsage {
  kind: "page" | "template" | "settings" | "action";
  id: string;
  name: string;
}

/** Human size like "1.4 MB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10485760 ? 1 : 0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** Width and height of a PNG, GIF, JPEG or WebP read from the header; null when unknown. */
export function imageSize(data: Uint8Array): { width: number; height: number } | null {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length >= 24 && at(data, 0, [0x89, 0x50, 0x4e, 0x47]))
    return { width: v.getUint32(16), height: v.getUint32(20) };
  if (data.length >= 10 && ascii(data, 0, "GIF8"))
    return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
  if (data.length >= 30 && ascii(data, 0, "RIFF") && ascii(data, 8, "WEBP")) {
    if (ascii(data, 12, "VP8X"))
      return {
        width: 1 + (data[24]! | (data[25]! << 8) | (data[26]! << 16)),
        height: 1 + (data[27]! | (data[28]! << 8) | (data[29]! << 16))
      };
    if (ascii(data, 12, "VP8L")) {
      const b = v.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (ascii(data, 12, "VP8 "))
      return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
    return null;
  }
  if (at(data, 0, [0xff, 0xd8])) {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = data[i + 1]!;
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return { width: v.getUint16(i + 7), height: v.getUint16(i + 5) };
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      i += 2 + v.getUint16(i + 2);
    }
  }
  return null;
}
