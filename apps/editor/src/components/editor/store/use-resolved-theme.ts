import { resolveTheme, themeDefaultMode, themeModes, type Theme } from "@nextomic/schema";
import { useMemo } from "react";
import { useEditorStore } from "./editor-store";

/** The theme that applies to the page being edited: forced in page settings, by conditions, or the default. */
export function useResolvedTheme(): Theme | null {
  const themes = useEditorStore((s) => s.project.themes);
  const pageId = useEditorStore((s) => s.page?.id ?? "");
  const route = useEditorStore((s) => s.doc?.route ?? "/");
  const forcedThemeId = useEditorStore((s) => s.doc?.settings.themeId ?? null);
  return useMemo(
    () => resolveTheme(themes, { pageId, route, forcedThemeId }).theme,
    [themes, pageId, route, forcedThemeId]
  );
}

/** The top bar previews one mode id; a theme without that mode shows its default mode. */
export function themeModeFor(theme: Theme | null, preferred: string): string {
  if (!theme) return preferred;
  return themeModes(theme).some((m) => m.id === preferred) ? preferred : themeDefaultMode(theme);
}
