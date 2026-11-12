import { MEDIA_WIDTHS, mediaVariantKey, type MediaAsset } from "@nextomic/schema";
import { getStorageAdapter } from "@/lib/storage";

// Resized copies of uploaded images (docs/ui-reference.md 4.6). Made on the first request for a
// width, stored under `media-variants/...`, and served from storage after that. The original is
// always the fallback: a failed resize never breaks an image.

const MAX_INPUT_PIXELS = 60_000_000;
const WEBP_QUALITY = 80;
const MAX_PARALLEL = 2;

export type VariantWidth = (typeof MEDIA_WIDTHS)[number];

export const isVariantWidth = (n: number): n is VariantWidth =>
  (MEDIA_WIDTHS as readonly number[]).includes(n);

/** Whether a request for this width should get a resized copy rather than the original. */
export function wantsVariant(asset: MediaAsset, width: number | null): boolean {
  if (width === null || !isVariantWidth(width)) return false;
  if (asset.kind !== "image" || asset.mime === "image/gif") return false;
  if (asset.width !== null && width >= asset.width) return false;
  return true;
}

const inflight = new Map<string, Promise<Uint8Array | null>>();
let active = 0;
const waiting: (() => void)[] = [];

async function slot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

async function resize(original: Uint8Array, width: number): Promise<Uint8Array | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * The resized copy for `width`, from storage or made now (one at a time per copy, two at a time
 * overall). Null when it cannot be made; the caller then serves the original.
 */
export async function variantBytes(
  projectId: string,
  asset: MediaAsset,
  width: VariantWidth,
  loadOriginal: () => Promise<Uint8Array | null>
): Promise<Uint8Array | null> {
  const key = mediaVariantKey(projectId, asset.id, asset.hash, width);
  const storage = getStorageAdapter();
  const stored = await storage.get(key).catch(() => null);
  if (stored) return stored;
  const running = inflight.get(key);
  if (running) return running;
  const job = slot(async () => {
    const original = await loadOriginal();
    if (!original) return null;
    const made = await resize(original, width);
    if (made)
      await storage.put({ key, data: made, contentType: "image/webp" }).catch(() => undefined);
    return made;
  }).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Removes every resized copy of one version of an asset (after Replace file or deleting it). */
export async function deleteVariants(projectId: string, id: string, hash: string): Promise<void> {
  const storage = getStorageAdapter();
  await Promise.all(
    MEDIA_WIDTHS.map((w) =>
      storage.delete(mediaVariantKey(projectId, id, hash, w)).catch(() => undefined)
    )
  );
}
