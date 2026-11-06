import { sortFontFiles, type FontFile, type ProjectFont } from "@nextomic/schema";

export type FontCategoryId = "favorites" | "custom" | "google" | "standard";

export const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Normal",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black"
};

export const WEIGHT_OPTIONS = Object.entries(WEIGHT_NAMES).map(([w, name]) => ({
  value: w,
  label: `${w} (${name})`
}));

export const weightLabel = (f: Pick<FontFile, "weight" | "weightMax">): string =>
  f.weightMax
    ? `${f.weight}–${f.weightMax} variable`
    : `${f.weight} (${WEIGHT_NAMES[f.weight] ?? "Custom"})`;

/** The weight a font is shown in (font manager cards): 400 when a face covers it, else the lowest weight. */
export function previewWeight(font: Pick<ProjectFont, "files">): number {
  const covers = font.files.some((f) => f.weight <= 400 && 400 <= (f.weightMax ?? f.weight));
  if (covers || font.files.length === 0) return 400;
  return Math.min(...font.files.map((f) => f.weight));
}

/** Weight range and style identify a variation inside a font. */
export const fileKey = (f: Pick<FontFile, "weight" | "weightMax" | "style">): string =>
  `${f.weight}-${f.weightMax ?? ""}-${f.style}`;

/** The files with `added` merged in; an added file replaces the one with the same weight and style. Always low to high weight. */
export function mergeFiles(existing: readonly FontFile[], added: readonly FontFile[]): FontFile[] {
  const keys = new Set(added.map(fileKey));
  return sortFontFiles([...existing.filter((f) => !keys.has(fileKey(f))), ...added]);
}

/** True when two variations share a weight and style (they would fight in @font-face). */
export const hasDuplicateVariation = (files: readonly FontFile[]): boolean =>
  new Set(files.map(fileKey)).size !== files.length;

export function filterFonts(
  fonts: readonly ProjectFont[],
  category: FontCategoryId,
  query: string
): ProjectFont[] {
  const q = query.trim().toLowerCase();
  return fonts
    .filter((f) => {
      if (category === "favorites" && !f.favorite) return false;
      if (category === "custom" && f.source !== "upload") return false;
      if (category === "google" && f.source !== "google") return false;
      return !q || f.family.toLowerCase().includes(q);
    })
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.family.localeCompare(b.family));
}

export function categoryCounts(
  fonts: readonly ProjectFont[]
): Record<Exclude<FontCategoryId, "standard">, number> {
  return {
    favorites: fonts.filter((f) => f.favorite).length,
    custom: fonts.filter((f) => f.source === "upload").length,
    google: fonts.filter((f) => f.source === "google").length
  };
}
