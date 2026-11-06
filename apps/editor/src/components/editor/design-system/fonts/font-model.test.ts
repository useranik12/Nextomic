import type { FontFile, ProjectFont } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import {
  categoryCounts,
  filterFonts,
  fileKey,
  hasDuplicateVariation,
  mergeFiles,
  previewWeight
} from "./font-model";

const file = (
  weight: number,
  style: "normal" | "italic" = "normal",
  weightMax?: number
): FontFile => ({
  file: `${weight}-${style}.woff2`,
  format: "woff2",
  weight,
  ...(weightMax ? { weightMax } : {}),
  style,
  subset: "latin",
  bytes: 100,
  sha256: "a".repeat(64)
});
const font = (family: string, source: "google" | "upload", favorite = false): ProjectFont => ({
  id: family.toLowerCase(),
  family,
  source,
  sourceNote: "",
  category: "sans-serif",
  license: "",
  favorite,
  rights: true,
  active: true,
  preload: false,
  display: "swap",
  files: [file(400)]
});

describe("font manager model", () => {
  it("merges added files over the same weight and style", () => {
    const merged = mergeFiles(
      [file(400), file(700)],
      [{ ...file(400), bytes: 999 }, file(400, "italic")]
    );
    expect(merged.map(fileKey)).toEqual(["400--italic", "400--normal", "700--normal"]);
    expect(merged.find((f) => fileKey(f) === "400--normal")?.bytes).toBe(999);
  });

  it("keeps merged faces in order of weight", () => {
    const merged = mergeFiles([file(700), file(300)], [file(500), file(100, "italic")]);
    expect(merged.map((f) => f.weight)).toEqual([100, 300, 500, 700]);
  });

  it("previews a font at 400, else at its lowest weight", () => {
    const withFiles = (files: FontFile[]): ProjectFont => ({ ...font("A", "upload"), files });
    expect(previewWeight(withFiles([file(300), file(400), file(700)]))).toBe(400);
    expect(previewWeight(withFiles([file(100, "normal", 900)]))).toBe(400);
    expect(previewWeight(withFiles([file(500), file(700)]))).toBe(500);
    expect(previewWeight(withFiles([file(900), file(300)]))).toBe(300);
    expect(previewWeight(withFiles([]))).toBe(400);
  });

  it("detects duplicate variations", () => {
    expect(hasDuplicateVariation([file(400), file(400, "italic")])).toBe(false);
    expect(hasDuplicateVariation([file(400), file(400)])).toBe(true);
    expect(hasDuplicateVariation([file(100, "normal", 900), file(100)])).toBe(false);
  });

  it("filters by category and search, favorites first", () => {
    const fonts = [
      font("Satoshi", "upload"),
      font("Inter", "google", true),
      font("Lora", "google")
    ];
    expect(filterFonts(fonts, "custom", "").map((f) => f.family)).toEqual(["Satoshi"]);
    expect(filterFonts(fonts, "google", "").map((f) => f.family)).toEqual(["Inter", "Lora"]);
    expect(filterFonts(fonts, "favorites", "").map((f) => f.family)).toEqual(["Inter"]);
    expect(filterFonts(fonts, "google", "lo").map((f) => f.family)).toEqual(["Lora"]);
    expect(categoryCounts(fonts)).toEqual({ favorites: 1, custom: 1, google: 2 });
  });
});
