import { getIconData, iconToSVG } from "@iconify/utils";
import type { IconifySet } from "./icons";
import { sanitizeSvg, SvgError } from "./svg-sanitize";

export interface IconRenderOptions {
  /** CSS length for the icon height; the width follows the icon's own ratio. Default `1em`. */
  size?: string;
  /** Names a meaningful icon for screen readers. Without it the icon is decorative (`aria-hidden`). */
  label?: string;
}

const escapeAttr = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const SIZE = /^[0-9.]+(px|em|rem|%)?$/;

/**
 * One icon of an Iconify set as inline SVG: aliases, flips and rotation resolved, drawn with
 * `currentColor` (sets that carry their own colors keep them), and run through the icon-mode
 * sanitizer, which keeps safe SMIL so animated icons still move. Null when the icon does not exist
 * or its markup cannot be made safe.
 */
export function iconSvg(
  set: Pick<IconifySet, "icons" | "aliases" | "width" | "height">,
  name: string,
  options: IconRenderOptions = {}
): string | null {
  const data = getIconData({ prefix: "i", ...set } as Parameters<typeof getIconData>[0], name);
  if (!data) return null;
  const size = options.size && SIZE.test(options.size) ? options.size : "1em";
  const built = iconToSVG(data, { height: size });
  const a11y = options.label
    ? `role="img" aria-label="${escapeAttr(options.label)}"`
    : 'aria-hidden="true"';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${built.attributes.viewBox}" ` +
    `width="${built.attributes.width ?? size}" height="${built.attributes.height ?? size}" ${a11y}>` +
    `${built.body}</svg>`;
  try {
    return sanitizeSvg(svg, { animations: true });
  } catch (error) {
    if (error instanceof SvgError) return null;
    throw error;
  }
}

/** Renders a catalog preview (body plus its own size) the same way as a full set icon. */
export function sampleSvg(sample: { body: string; width: number; height: number }): string | null {
  return iconSvg(
    { icons: { sample: { body: sample.body, width: sample.width, height: sample.height } } },
    "sample"
  );
}
