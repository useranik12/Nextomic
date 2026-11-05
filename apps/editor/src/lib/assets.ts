export const brandAssets = {
  brandNameDark: {
    slug: "brand-name-dark",
    source: "assets/brandings/svg/brand-name-dark.svg",
    background: "dark"
  },
  brandNameLight: {
    slug: "brand-name-light",
    source: "assets/brandings/svg/brand-name-light.svg",
    background: "light"
  },
  favicon: {
    slug: "favicon",
    source: "assets/brandings/svg/favicon.svg",
    background: "any"
  }
} as const;

export type BrandAssetSlug = (typeof brandAssets)[keyof typeof brandAssets]["slug"];
