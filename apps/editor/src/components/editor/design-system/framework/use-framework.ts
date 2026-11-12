"use client";

import {
  effectiveFramework,
  effectiveTheme,
  frameworkSchema,
  followsPrimary,
  themeListSchema,
  withFramework,
  type Framework,
  type Theme
} from "@nextomic/schema";
import { useState } from "react";
import { useEditorStore } from "../../store/editor-store";

/**
 * The theme being edited and its framework, with a validated way to replace the framework. A theme
 * that follows the primary shows the primary's framework with its own values on top; an edit then
 * stores only what differs, and changes to names, classes or structure are refused.
 */
export function useFramework() {
  const themes = useEditorStore((s) => s.project.themes);
  const setThemes = useEditorStore((s) => s.setThemes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stored: Theme | null =
    themes.find((t) => t.id === selectedId) ?? themes.find((t) => t.isDefault) ?? themes[0] ?? null;
  const follows = stored ? followsPrimary(stored, themes) : false;
  const theme = stored ? effectiveTheme(stored, themes) : null;

  /** Returns an error message, or null when the framework was saved to the theme. */
  function setFramework(next: Framework | null): string | null {
    if (!stored) return "Create a theme first.";
    if (next) {
      const checked = frameworkSchema.safeParse(next);
      if (!checked.success) return checked.error.issues[0]?.message ?? "Invalid framework.";
    }
    const changed = withFramework(stored, themes, next);
    if (typeof changed === "string") return changed;
    const list = themes.map((t) => (t.id === stored.id ? changed : t));
    const parsed = themeListSchema.safeParse(list);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid theme.";
    setThemes(parsed.data);
    return null;
  }

  return {
    themes,
    theme,
    follows,
    framework: stored ? effectiveFramework(stored, themes) : null,
    setSelectedId,
    setFramework
  };
}
