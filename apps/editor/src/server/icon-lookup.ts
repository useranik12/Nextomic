import {
  iconFontFaceCss,
  iconFontGlyphCss,
  iconRefKey,
  iconSvg,
  walkElements,
  type ElementNode,
  type IconLibrary,
  type IconifySet
} from "@nextomic/schema";
import type { IconLookup } from "@nextomic/renderer";
import { z } from "zod";
import { loadGlyphs, loadSet } from "./icons";

// The icons a page draws. The Icon element stores `{ library, name }` and the library is always a
// fixed key (only the name may be dynamic), so the libraries a page needs are known before it
// renders. Their data is loaded once (cached) and the renderer then looks icons up synchronously,
// also names that come from loop rows. Libraries the project no longer has draw nothing.

/** Library keys of the Icon elements in the given trees (elements set to SVG code use none). */
export function iconLibraryKeys(trees: readonly ElementNode[]): string[] {
  const keys = new Set<string>();
  for (const tree of trees) {
    walkElements(tree, (node) => {
      if (node.type !== "icon" || node.props.source === "svg") return;
      const key = node.props.library;
      if (typeof key === "string" && key !== "") keys.add(key);
    });
  }
  return [...keys];
}

export interface PageIcons {
  icons: IconLookup;
  /** @font-face and glyph rules of the icon-font libraries the page uses. */
  iconCss: string;
}

/**
 * Loads the libraries the trees use and returns what the renderer needs. A disabled library still
 * draws icons already placed; "disabled" only hides it from the picker.
 */
export async function pageIcons(
  projectId: string,
  libraries: readonly IconLibrary[],
  trees: readonly ElementNode[]
): Promise<PageIcons> {
  const sets = new Map<string, IconifySet>();
  const glyphs = new Map<string, Record<string, string>>();
  let iconCss = "";
  for (const key of iconLibraryKeys(trees)) {
    const library = libraries.find((l) => l.key === key);
    if (!library) continue;
    try {
      if (library.mode === "font") {
        const map = await loadGlyphs(projectId, library);
        glyphs.set(key, map);
        iconCss += iconFontFaceCss(library, `/icons/${projectId}`) + iconFontGlyphCss(key, map);
      } else {
        sets.set(key, await loadSet(projectId, library));
      }
    } catch {
      // Missing or unreadable data: that library's icons draw nothing instead of failing the page.
    }
  }
  return {
    iconCss,
    icons: {
      font: (library, name) => glyphs.get(library)?.[name] !== undefined,
      svg: (library, name, options) => {
        const set = sets.get(library);
        return set ? iconSvg(set, name, options) : null;
      }
    }
  };
}

// ---- The editor canvas ---------------------------------------------------------------------------
// The canvas renders in the browser and finds out which icons it needs while it renders (names may
// come from loop rows), then asks for exactly those. Nothing but the drawn icons reaches the browser.

export const iconRefsSchema = z
  .array(
    z.object({
      library: z.string().max(60),
      name: z.string().max(120),
      size: z.string().max(12),
      label: z.string().max(200)
    })
  )
  .max(300);
export type IconRefs = z.infer<typeof iconRefsSchema>;

export interface DrawnIcons {
  /** Inline SVG by `iconRefKey`; null when the icon is not known. */
  svg: Record<string, string | null>;
  /** Icon-font glyphs by `library\0name`. */
  fonts: Record<string, true>;
  /** @font-face and glyph rules for the font glyphs above. */
  css: string;
}

/** Draws the icons the canvas asked for from the given libraries (the project draft). */
export async function drawIcons(
  projectId: string,
  libraries: readonly IconLibrary[],
  refs: IconRefs
): Promise<DrawnIcons> {
  const out: DrawnIcons = { svg: {}, fonts: {}, css: "" };
  const faces = new Set<string>();
  for (const ref of refs) {
    const library = libraries.find((l) => l.key === ref.library);
    const key = iconRefKey(ref.library, ref.name, ref.size, ref.label);
    out.svg[key] = null;
    if (!library) continue;
    try {
      if (library.mode === "font") {
        const hex = (await loadGlyphs(projectId, library))[ref.name];
        if (hex === undefined) continue;
        out.fonts[[ref.library, ref.name].join("\u0000")] = true;
        if (!faces.has(library.key)) {
          faces.add(library.key);
          out.css += iconFontFaceCss(library, `/icons/${projectId}`);
        }
        out.css += iconFontGlyphCss(library.key, { [ref.name]: hex });
      } else {
        out.svg[key] = iconSvg(await loadSet(projectId, library), ref.name, {
          size: ref.size,
          label: ref.label
        });
      }
    } catch {
      // Unreadable library data: its icons draw nothing.
    }
  }
  return out;
}
