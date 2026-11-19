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

async function encodeBitmap(bitmap: ImageBitmap, quality: number): Promise<Blob | null> {
  const { width, height } = bitmap;
  if (width * height > MAX_PIXELS) return null;
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
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
  options: { includeGif?: boolean; alwaysConvert?: boolean } = {}
): Promise<File> {
  if (!canConvert(file, options)) return file;
  const heic = isHeicFile(file);
  const q = Math.min(100, Math.max(1, quality)) / 100;
  try {
    let blob: Blob | null = null;
    let bitmap = await decode(file);
    if (bitmap) {
      blob = await encodeBitmap(bitmap, q);
      bitmap.close();
      bitmap = null;
    } else if (heic) {
      // Only Safari reads HEIC natively; everyone else goes through a small WebAssembly decoder.
      const { heicTo } = await import("heic-to/next");
      blob = await heicTo({ blob: file, type: "image/webp", quality: q });
    }
    if (!blob || blob.type !== "image/webp") return file;
    if (!heic && !options.alwaysConvert && blob.size >= file.size) return file;
    return new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * The file a project upload should send: shrunk to WebP when the project asks for it, and always
 * converted when it is HEIC. Throws when a HEIC photo cannot be converted, because the server cannot store it.
 */
export async function prepareProjectImage(
  file: File,
  settings: { enabled: boolean; quality: number }
): Promise<File> {
  const heic = isHeicFile(file);
  if (!settings.enabled && !heic) return file;
  const prepared = await toWebp(file, settings.enabled ? settings.quality : 80);
  if (heic && prepared === file)
    throw new Error(
      "This HEIC photo could not be converted. Export it as JPG or PNG and try again."
    );
  return prepared;
}
