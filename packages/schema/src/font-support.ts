import { isFontUsable, type ProjectFont } from "./fonts";

/** What a project font can really draw. Typography settings only offer these. */
export interface FontSupport {
  family: string;
  /** Weights to offer, low to high: every installed static weight and the steps inside variable ranges. */
  weights: number[];
  /** True when an italic face is installed. */
  italic: boolean;
}

/** The first family of a `font-family` value, unquoted; null when it is empty or a variable reference. */
export function primaryFamily(stack: string | undefined): string | null {
  const first = stack?.trim().split(",")[0]?.trim();
  if (!first || first.startsWith("var(")) return null;
  return first.replace(/^["']|["']$/g, "") || null;
}

/**
 * The support of the project font a stack starts with. Null means the family is a system font or
 * not set, which the browser can draw in any weight and style, so nothing is hidden.
 */
export function fontSupportFor(
  fonts: readonly ProjectFont[],
  stack: string | undefined
): FontSupport | null {
  const family = primaryFamily(stack);
  if (!family) return null;
  const font = fonts.find((f) => f.family.toLowerCase() === family.toLowerCase());
  if (!font || !isFontUsable(font) || font.files.length === 0) return null;
  const weights = new Set<number>();
  for (const file of font.files) {
    if (file.weightMax === undefined || file.weightMax <= file.weight) {
      weights.add(file.weight);
      continue;
    }
    weights.add(file.weight);
    weights.add(file.weightMax);
    for (let w = Math.ceil(file.weight / 100) * 100; w <= file.weightMax; w += 100) weights.add(w);
  }
  return {
    family: font.family,
    weights: [...weights].sort((a, b) => a - b),
    italic: font.files.some((f) => f.style === "italic")
  };
}
