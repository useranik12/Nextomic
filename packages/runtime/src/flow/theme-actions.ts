import { toText, type ThemeChoice } from "@nextomic/schema";
import { FlowError, type ActionHandler } from "./engine";

// Set Theme (docs/templates-and-themes.md 3.4, dynamic-data-and-actions.md 8.10). The page ships
// the CSS of every theme a visitor can switch to; this switches `data-nxt-theme` on <html> and
// remembers the choice in a first-party cookie the boot script reads on the next page load. A later
// version keeps the choice in the visitor's saved settings instead.

export const THEME_COOKIE = "nxt-theme";
const YEAR = 60 * 60 * 24 * 365;

function remember(slug: string): void {
  const secure = window.location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `${THEME_COOKIE}=${slug};path=/;max-age=${YEAR};SameSite=Lax${secure}`;
}

/** Switches the page to the theme; its color mode stays when the theme has it, else its default. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  const mode = root.getAttribute("data-nxt-mode") ?? "";
  root.setAttribute("data-nxt-theme", choice.slug);
  if (!choice.modes.includes(mode)) root.setAttribute("data-nxt-mode", choice.defaultMode);
  remember(choice.slug);
}

export function themeHandlers(
  themes: readonly ThemeChoice[],
  apply: (choice: ThemeChoice) => void = applyTheme
): Record<string, ActionHandler> {
  return {
    "theme.set": (p) => {
      const id = toText(p.theme);
      if (id === "") throw new FlowError("no-theme", "Choose the theme to switch to.");
      if (themes.length === 0)
        throw new FlowError(
          "no-themes",
          "This page cannot switch themes. Turn on Follow the primary theme for another active theme."
        );
      const choice = themes.find((t) => t.id === id);
      if (!choice)
        throw new FlowError(
          "theme-gone",
          "That theme is off, or does not follow the primary theme."
        );
      apply(choice);
    }
  };
}
