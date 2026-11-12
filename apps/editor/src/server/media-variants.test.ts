import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "@nextomic/schema";

const stored = new Map<string, Uint8Array>();
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: () => ({
    put: async (i: { key: string; data: Uint8Array }) => void stored.set(i.key, i.data),
    get: async (k: string) => stored.get(k) ?? null,
    delete: async (k: string) => void stored.delete(k),
    getUrl: async (k: string) => k
  })
}));

import { deleteVariants, isVariantWidth, variantBytes, wantsVariant } from "./media-variants";

const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "a1b2c3d4e5f60718293a4b5c",
  folderId: null,
  title: "",
  originalName: "pic.png",
  fileName: "pic.png",
  kind: "image",
  mime: "image/png",
  size: 1000,
  width: 2000,
  height: 1000,
  alt: "",
  caption: "",
  tags: [],
  path: "/media/p1/a1b2c3d4e5f60718293a4b5c/pic.png",
  hash: "0123456789abcdef",
  replacedAt: null,
  trashedAt: null,
  createdAt: new Date().toISOString(),
  ...over
});

const png = () =>
  sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#336699" } })
    .png()
    .toBuffer();

beforeEach(() => stored.clear());

describe("wantsVariant", () => {
  it("only for allowed widths smaller than the image", () => {
    expect(wantsVariant(asset(), 640)).toBe(true);
    expect(wantsVariant(asset(), 641)).toBe(false);
    expect(wantsVariant(asset(), null)).toBe(false);
    expect(wantsVariant(asset(), 1920)).toBe(true);
    expect(wantsVariant(asset({ width: 600 }), 640)).toBe(false);
  });
  it("never for SVG, GIF or other kinds", () => {
    expect(wantsVariant(asset({ kind: "svg", mime: "image/svg+xml" }), 640)).toBe(false);
    expect(wantsVariant(asset({ mime: "image/gif" }), 640)).toBe(false);
    expect(wantsVariant(asset({ kind: "video" }), 640)).toBe(false);
  });
  it("knows its allow-list", () => {
    expect(isVariantWidth(960)).toBe(true);
    expect(isVariantWidth(961)).toBe(false);
  });
});

describe("variantBytes", () => {
  it("resizes once, stores the copy and serves it from storage after", async () => {
    const original = await png();
    const load = vi.fn(async () => original);
    const a = asset();
    const first = await variantBytes("p1", a, 640, load);
    expect(first).not.toBeNull();
    const meta = await sharp(first!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 640, 320]);
    expect([...stored.keys()]).toEqual([
      "media-variants/p1/a1b2c3d4e5f60718293a4b5c/01234567-640.webp"
    ]);
    await variantBytes("p1", a, 640, load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("runs one resize for many requests at once", async () => {
    const original = await png();
    const load = vi.fn(async () => original);
    await Promise.all([1, 2, 3, 4].map(() => variantBytes("p1", asset(), 320, load)));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("returns null for bytes that are not an image, so the original is served", async () => {
    const out = await variantBytes("p1", asset({ id: "ffffffffffffffffffffffff" }), 320, async () =>
      new TextEncoder().encode("not an image")
    );
    expect(out).toBeNull();
    expect(stored.size).toBe(0);
  });

  it("deleteVariants removes every width of one version", async () => {
    const original = await png();
    const a = asset();
    await variantBytes("p1", a, 320, async () => original);
    await variantBytes("p1", a, 640, async () => original);
    expect(stored.size).toBe(2);
    await deleteVariants("p1", a.id, a.hash);
    expect(stored.size).toBe(0);
  });
});
