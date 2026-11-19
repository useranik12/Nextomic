import { PROJECT_IMAGE_MAX_SIDE } from "@nextomic/schema";

// Shrinks an image to WebP in the browser, so the upload is smaller and the builder's server never
// does the work. Anything this cannot handle is returned unchanged; the server still checks every
// upload, so a failed or skipped conversion never blocks the person.

const MAX_PIXELS = 100_000_000;

const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence"
]);
const RASTER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/x-ms-bmp"
]);

const extensionOf = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";

/** HEIC and HEIF photos (iPhone and similar). Browsers cannot show them, so they are always converted. */
export function isHeicFile(file: { name: string; type: string }): boolean {
  return (
    HEIC_TYPES.has(file.type) || ["heic", "heif", "heics", "heifs"].includes(extensionOf(file.name))
  );
}

/** Whether the file is a still image this module can turn into WebP. SVG and GIF are left alone unless asked. */
export function canConvert(
  file: { name: string; type: string },
  options: { includeGif?: boolean } = {}
): boolean {
  if (isHeicFile(file)) return true;
  if (file.type === "image/gif" || extensionOf(file.name) === "gif")
    return options.includeGif === true;
  if (RASTER_TYPES.has(file.type)) return true;
  return (
    file.type === "" &&
    ["png", "jpg", "jpeg", "webp", "avif", "bmp"].includes(extensionOf(file.name))
  );
}

/** The same name with a .webp extension. */
export function webpName(name: string): string {
  const base = name.replace(/[.][^./\\]+$/, "");
  return `${base || "image"}.webp`;
}

/**
 * The size that fits `maxSide` pixels on the longer side, keeping the proportions. Smaller images
 * keep their size (nothing is enlarged). 1536 x 2048 within 1500 gives 1125 x 1500.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number | undefined
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (!maxSide || longest <= maxSide) return { width, height, scaled: false };
  const ratio = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true
  };
}

interface Encoded {
  blob: Blob;
  scaled: boolean;
}

async function encodeBitmap(
  bitmap: ImageBitmap,
  quality: number,
  maxSide: number | undefined
): Promise<Encoded | null> {
  if (bitmap.width * bitmap.height > MAX_PIXELS) return null;
  const { width, height, scaled } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  const blob =
    canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: "image/webp", quality })
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  return blob ? { blob, scaled } : null;
}

async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/**
 * The image as WebP at `quality` percent (1 to 100). A file that is not a convertible image, cannot
 * be decoded, or would get bigger comes back as it was. HEIC always converts (nothing else can show it).
 */
export async function toWebp(
  file: File,
  quality: number,
  options: { includeGif?: boolean; alwaysConvert?: boolean; maxSide?: number } = {}
): Promise<File> {
  if (!canConvert(file, options)) return file;
  const heic = isHeicFile(file);
  const q = Math.min(100, Math.max(1, quality)) / 100;
  try {
    // Only Safari reads HEIC natively; everyone else goes through a small WebAssembly decoder.
    const bitmap =
      (await decode(file)) ??
      (heic ? await (await import("heic-to/next")).heicTo({ blob: file, type: "bitmap" }) : null);
    if (!bitmap) return file;
    const encoded = await encodeBitmap(bitmap, q, options.maxSide);
    bitmap.close();
    if (!encoded || encoded.blob.type !== "image/webp") return file;
    // A resized copy is always used (the size limit is the point); otherwise only a smaller one.
    const worthIt =
      heic || options.alwaysConvert || encoded.scaled || encoded.blob.size < file.size;
    if (!worthIt) return file;
    return new File([encoded.blob], webpName(file.name), {
      type: "image/webp",
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

/**
 * The file a project upload should send. With compression on: WebP at the chosen quality, no longer
 * than `PROJECT_IMAGE_MAX_SIDE` on its longer side. With it off: the file as it is, except HEIC,
 * which the server cannot store and is therefore converted at full size. Throws when a HEIC photo
 * cannot be converted.
 */
export async function prepareProjectImage(
  file: File,
  settings: { enabled: boolean; quality: number }
): Promise<File> {
  const heic = isHeicFile(file);
  if (!settings.enabled && !heic) return file;
  const prepared = settings.enabled
    ? await toWebp(file, settings.quality, { maxSide: PROJECT_IMAGE_MAX_SIDE })
    : await toWebp(file, 80);
  if (heic && prepared === file)
    throw new Error(
      "This HEIC photo could not be converted. Export it as JPG or PNG and try again."
    );
  return prepared;
}
