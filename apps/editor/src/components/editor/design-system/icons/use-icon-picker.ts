"use client";

import {
  ICON_SEARCH_PAGE,
  iconFontFaceCss,
  iconFontGlyphCss,
  type IconLibrary
} from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawIconsAction, searchIconsAction } from "@/app/(builder)/editor/[id]/icon-actions";

export interface IconRef {
  library: string;
  name: string;
}
/** One icon in the picker grid: inline SVG, or a glyph of an icon font (drawn with its class). */
export interface IconTile extends IconRef {
  svg?: string;
  font?: boolean;
}
/** "recent", "favorites", "" (all enabled libraries) or one library key. */
export type PickerTab = string;

const RECENT_MAX = 24;
const FAVORITES_MAX = 200;
const DEBOUNCE_MS = 250;

interface Saved {
  recent: IconRef[];
  favorites: IconRef[];
}

const storageKey = (projectId: string) => `nxt-icons:${projectId}`;

// Recent and favorites are a convenience of this browser (not shared with the team or other
// devices). Storage can be missing or blocked, so every access is guarded.
function readSaved(projectId: string): Saved {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? "{}");
    const list = (value: unknown): IconRef[] =>
      Array.isArray(value)
        ? value.filter(
            (r): r is IconRef =>
              typeof r?.library === "string" &&
              typeof r?.name === "string" &&
              r.library.length <= 60 &&
              r.name.length <= 120
          )
        : [];
    const saved = raw as Partial<Record<keyof Saved, unknown>>;
    return { recent: list(saved.recent), favorites: list(saved.favorites) };
  } catch {
    return { recent: [], favorites: [] };
  }
}

function writeSaved(projectId: string, saved: Saved): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(saved));
  } catch {
    // Not saved: the lists still work until the dialog closes.
  }
}

const same = (a: IconRef, b: IconRef) => a.library === b.library && a.name === b.name;

/**
 * The state of the icon picker: search, library tabs, paging, and the recent and favorite lists.
 * Search runs on the server (`searchIconsAction`), so the browser only ever holds the page of
 * icons it shows. Recent and favorites are drawn by the same server action the canvas uses.
 */
export function useIconPicker(projectId: string, libraries: readonly IconLibrary[]) {
  const enabled = useMemo(() => libraries.filter((l) => l.enabled), [libraries]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PickerTab>("");
  const [tiles, setTiles] = useState<IconTile[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState("");
  const [saved, setSaved] = useState<Saved>({ recent: [], favorites: [] });
  const run = useRef(0);
  // Where the next page of search results starts (the server pages by 60 matches).
  const nextOffset = useRef(0);

  useEffect(() => setSaved(readSaved(projectId)), [projectId]);

  const addRules = useCallback((css: string) => {
    if (css) setRules((current) => (current.includes(css) ? current : current + css));
  }, []);

  const load = useCallback(
    async (offset: number) => {
      const id = ++run.current;
      setBusy(true);
      setError(null);
      const list = tab === "recent" ? saved.recent : tab === "favorites" ? saved.favorites : null;
      let next: IconTile[] = [];
      let count = 0;
      let failure: string | null = null;
      if (list) {
        const q = query.trim().toLowerCase();
        const refs = list.filter((r) => q === "" || r.name.includes(q));
        count = refs.length;
        if (refs.length > 0) {
          const res = await drawIconsAction(
            projectId,
            enabledAndUsed(libraries, refs),
            refs.map((r) => ({ ...r, size: "1em", label: "" }))
          );
          if (res.error !== null) failure = res.error;
          else {
            addRules(res.data.css);
            next = refs.flatMap((r): IconTile[] => {
              const key = [r.library, r.name].join("\u0000");
              if (key in res.data.fonts) return [{ ...r, font: true }];
              const svg = res.data.svg[[r.library, r.name, "1em", ""].join("\u0000")];
              return svg ? [{ ...r, svg }] : [];
            });
          }
        }
      } else {
        const res = await searchIconsAction(projectId, enabled, { query, library: tab, offset });
        if (res.error !== null) failure = res.error;
        else {
          count = res.data.total;
          const glyphs = new Map<string, Record<string, string>>();
          next = res.data.hits.map((hit) => {
            if (hit.glyph === undefined)
              return { library: hit.library, name: hit.name, svg: hit.svg };
            glyphs.set(hit.library, { ...glyphs.get(hit.library), [hit.name]: hit.glyph });
            return { library: hit.library, name: hit.name, font: true };
          });
          for (const [key, map] of glyphs) addRules(iconFontGlyphCss(key, map));
        }
      }
      if (id !== run.current) return;
      setBusy(false);
      if (failure) setError(failure);
      else {
        nextOffset.current = list ? count : offset + ICON_SEARCH_PAGE;
        setTiles((current) => (offset === 0 ? next : [...current, ...next]));
        setTotal(count);
      }
    },
    [projectId, libraries, enabled, query, tab, saved.recent, saved.favorites, addRules]
  );

  // A new search or tab starts again from the first page, after a short pause while typing.
  useEffect(() => {
    const timer = setTimeout(() => void load(0), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [load]);

  const persist = useCallback(
    (next: Saved) => {
      setSaved(next);
      writeSaved(projectId, next);
    },
    [projectId]
  );

  const remember = useCallback(
    (ref: IconRef) =>
      persist({
        ...saved,
        recent: [ref, ...saved.recent.filter((r) => !same(r, ref))].slice(0, RECENT_MAX)
      }),
    [persist, saved]
  );

  const toggleFavorite = useCallback(
    (ref: IconRef) =>
      persist({
        ...saved,
        favorites: saved.favorites.some((r) => same(r, ref))
          ? saved.favorites.filter((r) => !same(r, ref))
          : [ref, ...saved.favorites].slice(0, FAVORITES_MAX)
      }),
    [persist, saved]
  );

  const fontFaces = useMemo(
    () =>
      libraries
        .filter((l) => l.mode === "font")
        .map((l) => iconFontFaceCss(l, `/icons/${projectId}`))
        .join(""),
    [libraries, projectId]
  );

  return {
    enabled,
    query,
    setQuery,
    tab,
    setTab,
    tiles,
    total,
    busy,
    error,
    css: fontFaces + rules,
    favorites: saved.favorites,
    isFavorite: (ref: IconRef) => saved.favorites.some((r) => same(r, ref)),
    toggleFavorite,
    remember,
    hasMore: nextOffset.current < total,
    loadMore: () => void load(nextOffset.current)
  };
}

/** The libraries of the given icons, including disabled ones: they hide from search only. */
function enabledAndUsed(
  libraries: readonly IconLibrary[],
  refs: readonly IconRef[]
): IconLibrary[] {
  const keys = new Set(refs.map((r) => r.library));
  return libraries.filter((l) => keys.has(l.key));
}
