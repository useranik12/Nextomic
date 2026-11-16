"use client";

import { createContext, useContext, useEffect } from "react";
import { useEditorStore } from "../store/editor-store";

// Small tools that sit beside a Design value: the unit chooser and the color palette. Which tools a
// property gets comes from `fieldKind`, so a tool never shows on a property it cannot fill.

export type FieldKind = "color" | "font" | "other";

export function fieldKind(property: string): FieldKind {
  if (/(^|-)color$/.test(property) || property === "fill" || property === "stroke") return "color";
  if (property === "font-family") return "font";
  return "other";
}

/**
 * Shows a hovered option on the canvas element before it is picked. `show` and `clear` go on an
 * option's hover and focus; the preview also ends when the picker closes or unmounts.
 */
/** A field whose value is stored under another key (Form Input settings) previews under that key. */
export const PreviewKeyContext = createContext<string | null>(null);

export function useStylePreview(property: string): {
  show: (value: string) => void;
  clear: () => void;
} {
  const set = useEditorStore((s) => s.setStylePreview);
  const override = useContext(PreviewKeyContext);
  const key = override ?? property;
  useEffect(() => () => set(null), [set]);
  return {
    show: (value) => set({ property: key, value }),
    clear: () => set(null)
  };
}

/** Props that make an option preview itself on hover and keyboard focus. */
export const previewProps = (
  preview: { show: (v: string) => void; clear: () => void },
  value: string
) => ({
  onMouseEnter: () => preview.show(value),
  onMouseLeave: preview.clear,
  onFocus: () => preview.show(value),
  onBlur: preview.clear
});
