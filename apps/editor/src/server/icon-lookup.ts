import {
  iconFontFaceCss,
  iconFontGlyphCss,
  iconSvg,
  walkElements,
  type ElementNode,
  type IconLibrary,
  type IconifySet
} from "@nextomic/schema";
import type { IconLookup } from "@nextomic/renderer";
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
