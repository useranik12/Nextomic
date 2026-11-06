"use client";

import { frameworkSchema, themeListSchema, type Framework, type Theme } from "@nextomic/schema";
import { useState } from "react";
import { useEditorStore } from "../../store/editor-store";

/** The theme being edited and its framework, with a validated way to replace the framework. */
export function useFramework() {
  const themes = useEditorStore((s) => s.project.themes);
  const setThemes = useEditorStore((s) => s.setThemes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const theme: Theme | null =
    themes.find((t) => t.id === selectedId) ?? themes.find((t) => t.isDefault) ?? themes[0] ?? null;

  /** Returns an error message, or null when the framework was saved to the theme. */
  function setFramework(next: Framework | null): string | null {
    if (!theme) return "Create a theme first.";
    if (next) {
      const checked = frameworkSchema.safeParse(next);
      if (!checked.success) return checked.error.issues[0]?.message ?? "Invalid framework.";
    }
    const list = themes.map((t) => (t.id === theme.id ? { ...t, framework: next } : t));
    const parsed = themeListSchema.safeParse(list);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid theme.";
    setThemes(parsed.data);
    return null;
  }

  return { themes, theme, framework: theme?.framework ?? null, setSelectedId, setFramework };
}
