import { describe, expect, it } from "vitest";
import {
  formatBytes,
  imageSize,
  mediaEditSchema,
  mediaFileName,
  mediaIdFromPath,
  mediaSrcSet,
  mediaVariantKey,
  mediaPath,
  mediaTagsSchema,
  mediaTitleFromName,
  refuseReason,
  sniffMedia
} from "./media";

const pad = (b: number[]) =>
  new Uint8Array([...b, ...new Array(Math.max(0, 16 - b.length)).fill(0)]);
const text = (s: string) => new TextEncoder().encode(s);
const iso = (brand: string) =>
  new Uint8Array([0, 0, 0, 24, ...text("ftyp"), ...text(brand), 0, 0, 0, 0, 0, 0, 0, 0]);

describe("sniffMedia", () => {
  const cases: [string, Uint8Array, string, string][] = [
    ["png", pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png", "image"],
    ["jpeg", pad([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", "image"],
    ["gif", text("GIF89a......."), "image/gif", "image"],
    ["webp", new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WEBP")]), "image/webp", "image"],
    ["wav", new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WAVE")]), "audio/wav", "audio"],
    ["ogg", new Uint8Array([...text("OggS"), ...new Array(12).fill(0)]), "audio/ogg", "audio"],
    ["pdf", text("%PDF-1.7 ......"), "application/pdf", "other"],
    ["webm", pad([0x1a, 0x45, 0xdf, 0xa3]), "video/webm", "video"],
    [
      "mp3 id3",
      new Uint8Array([...text("ID3"), 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      "audio/mpeg",
      "audio"
    ],
    ["mp3 frame", pad([0xff, 0xfb, 0x90]), "audio/mpeg", "audio"],
    ["avif", iso("avif"), "image/avif", "image"],
    ["mp4", iso("isom"), "video/mp4", "video"],
    ["mov", iso("qt  "), "video/quicktime", "video"],
    ["m4a", iso("M4A "), "audio/mp4", "audio"],
    ["svg", text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "image/svg+xml", "svg"],
    [
      "svg with xml header",
      text('<?xml version="1.0"?>\n<!-- c --><svg></svg>'),
      "image/svg+xml",
      "svg"
    ],
    ["svg with BOM", text("﻿  <SVG></SVG>"), "image/svg+xml", "svg"]
  ];
  for (const [name, data, mime, kind] of cases)
    it(`reads ${name} from its bytes`, () => {
      const f = sniffMedia(data);
      expect(f?.mime).toBe(mime);
      expect(f?.kind).toBe(kind);
    });

  it("refuses html, scripts, text and unknown ISO brands, whatever the name says", () => {
    for (const s of [
      "<!DOCTYPE html><html></html>",
      "<html><body></body></html>",
      "<script>alert(1)</script>",
      "<?xml version='1.0'?><html/>",
      "just some text here",
      "#!/bin/sh\necho hi\n"
    ])
      expect(sniffMedia(text(s))).toBeNull();
    expect(sniffMedia(iso("zzzz"))).toBeNull();
    expect(sniffMedia(new Uint8Array())).toBeNull();
  });

  it("explains a refusal", () => {
    expect(refuseReason(text("<!DOCTYPE html><html>"))).toMatch(/HTML and script/);
    expect(refuseReason(text("<foo/>"))).toMatch(/not an image/);
    expect(refuseReason(text("hello"))).toMatch(/not supported/);
  });
});

describe("names and paths", () => {
  it("builds a safe stored name with the proven extension", () => {
    expect(mediaFileName("My Photo (1).JPEG", "jpg")).toBe("my-photo-1.jpg");
    expect(mediaFileName("../../etc/passwd", "png")).toBe("etc-passwd.png");
    expect(mediaFileName("日本語.png", "png")).toBe("file.png");
    expect(mediaFileName("a".repeat(200) + ".png", "png").length).toBeLessThanOrEqual(64);
  });
  it("keeps a readable title", () => {
    expect(mediaTitleFromName("Team photo.png")).toBe("Team photo");
    expect(mediaTitleFromName("   ")).toBe("Untitled");
  });
  it("round-trips the asset id through the stored path", () => {
    const id = "a1b2c3d4e5f60718293a4b5c";
    const p = mediaPath("proj_1", id, "logo.svg");
    expect(p).toBe(`/media/proj_1/${id}/logo.svg`);
    expect(mediaIdFromPath(p)).toBe(id);
    expect(mediaIdFromPath(`${p}?w=300`)).toBe(id);
    expect(mediaIdFromPath("/other/x.png")).toBeNull();
    expect(mediaIdFromPath("https://x.com/media/p/" + id + "/a.png")).toBeNull();
  });
});

describe("metadata schemas", () => {
  it("trims, lowercases and dedupes tags", () => {
    expect(mediaTagsSchema.parse([" Hero ", "hero", "Team Photos"])).toEqual([
      "hero",
      "team photos"
    ]);
    expect(mediaTagsSchema.safeParse(["<b>"]).success).toBe(false);
    expect(mediaTagsSchema.safeParse(new Array(21).fill("a")).success).toBe(false);
  });
  it("accepts a partial edit and allows clearing the title", () => {
    expect(mediaEditSchema.parse({ alt: "  A cat " })).toEqual({ alt: "A cat" });
    expect(mediaEditSchema.parse({ title: "  " })).toEqual({ title: "" });
  });
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("imageSize", () => {
  it("reads PNG and GIF headers", () => {
    const png = new Uint8Array(32);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 640);
    new DataView(png.buffer).setUint32(20, 480);
    expect(imageSize(png)).toEqual({ width: 640, height: 480 });
    const gif = new Uint8Array([...text("GIF89a"), 10, 0, 20, 0, 0, 0]);
    expect(imageSize(gif)).toEqual({ width: 10, height: 20 });
  });
  it("reads a JPEG start-of-frame", () => {
    const jpg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 1, 0x2c, 1, 0x90, 3, 0, 0, 0
    ]);
    expect(imageSize(jpg)).toEqual({ width: 400, height: 300 });
  });
  it("returns null for the unknown", () => {
    expect(imageSize(text("not an image at all, sorry"))).toBeNull();
  });
});

describe("responsive images", () => {
  const id = "a1b2c3d4e5f60718293a4b5c";
  it("builds a srcset for stored raster images only", () => {
    const set = mediaSrcSet(`/media/p1/${id}/hero.jpg`);
    expect(set).toContain(`/media/p1/${id}/hero.jpg?w=320 320w`);
    expect(set).toContain("?w=1920 1920w");
    expect(mediaSrcSet(`/media/p1/${id}/logo.svg`)).toBeNull();
    expect(mediaSrcSet(`/media/p1/${id}/anim.gif`)).toBeNull();
    expect(mediaSrcSet(`/media/p1/${id}/hero.jpg?w=640`)).toBeNull();
    expect(mediaSrcSet("https://example.com/hero.jpg")).toBeNull();
    expect(mediaSrcSet("")).toBeNull();
  });
  it("keeps variants apart from the original key", () => {
    expect(mediaVariantKey("p1", id, "0123456789abcdef", 640)).toBe(
      `media-variants/p1/${id}/01234567-640.webp`
    );
  });
});
