/**
 * Typed registry for brand assets in assets/brandings (see docs/ui-reference.md section 5).
 * Never hardcode a path to assets/brandings outside this module — resolve by slug instead.
 */
export type BrandSlug = "brand-name" | "name-logo" | "mascot";
export type BrandVariant = "dark" | "light";
export type BrandFormat = "svg" | "png" | "webp";

const BRAND_SLUGS: readonly BrandSlug[] = ["brand-name", "name-logo", "mascot"];

function brandUrl(format: BrandFormat, filename: string): string {
  return `/brand/${format}/${filename}`;
}

export function getBrandAsset(slug: BrandSlug, variant: BrandVariant, format: BrandFormat = "svg") {
  if (!BRAND_SLUGS.includes(slug)) {
    throw new Error(`Unknown brand asset slug: ${slug}`);
  }
  return brandUrl(format, `${slug}-${variant}.${format}`);
}

export function getFaviconAsset(format: BrandFormat = "svg") {
  return brandUrl(format, `favicon.${format}`);
}
