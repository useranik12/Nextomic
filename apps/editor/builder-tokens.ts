import plugin from "tailwindcss/plugin";
import tokens from "../../blueprint/tokens.json" with { type: "json" };

// HeroUI v3 semantic variables for the BUILDER UI, derived from blueprint/tokens.json (the single
// source of truth for builder colors; see docs/ui-reference.md "Builder design rules"). HeroUI v3
// reads these variables (background, surface, overlay, muted, default, field-*, accent...). The
// selectors are more specific than v3's own `:root` / `.dark` so these values win. Built sites
// never load this (see CLAUDE.md "Separate layers").

type Mode = "dark" | "light";

function vars(mode: Mode): Record<string, string> {
  const m = tokens.modes[mode];
  const d = m.colors.default;
  const accent = m.colors.primary.DEFAULT;
  return {
    "color-scheme": mode,
    "--background": m.layout.background,
    "--foreground": m.layout.foreground,
    "--surface": m.content.content1,
    "--surface-foreground": m.layout.foreground,
    "--surface-secondary": m.content.content2,
    "--surface-secondary-foreground": m.layout.foreground,
    "--surface-tertiary": m.content.content3,
    "--surface-tertiary-foreground": m.layout.foreground,
    "--overlay": m.content.content1,
    "--overlay-foreground": m.layout.foreground,
    // Text role "muted" (labels, descriptions); also HeroUI's own muted text.
    "--muted": d["500"],
    // Secondary buttons and soft fills: the "very light gray" of the design rules.
    "--default": d["100"],
    "--default-foreground": m.layout.foreground,
    "--default-hover": d["200"],
    "--accent": accent,
    "--accent-foreground": m.colors.primary.foreground,
    "--success": m.colors.success.DEFAULT,
    "--success-foreground": m.colors.success.foreground,
    "--warning": m.colors.warning.DEFAULT,
    "--warning-foreground": m.colors.warning.foreground,
    "--danger": m.colors.danger.DEFAULT,
    "--danger-foreground": m.colors.danger.foreground,
    "--border": d["200"],
    "--separator": d["100"],
    "--focus": m.layout.focus,
    "--link": mode === "dark" ? m.colors.primary["500"] : m.colors.primary["600"],
    "--segment": mode === "dark" ? d["200"] : m.content.content1,
    "--segment-foreground": m.layout.foreground,
    // Fields: transparent with a 1px border; hover lifts the border, focus turns it blue.
    "--field-background": "transparent",
    "--field-foreground": m.layout.foreground,
    "--field-placeholder": d["400"],
    "--field-border": d["200"],
    "--field-border-hover": d["400"],
    "--field-border-focus": accent,
    "--field-hover": "transparent",
    "--field-focus": "transparent",
    // Text roles (docs/ui-reference.md): strong = foreground, then body, muted, subtle.
    "--nx-text-body": d["600"],
    "--nx-text-subtle": d["400"]
  };
}

export default plugin(({ addBase }) => {
  addBase({
    "html:root": {
      "--radius": tokens.radius.small,
      "--field-radius": tokens.radius.full,
      "--border-width-field": "1px",
      "--field-border-width": "1px",
      "--tooltip-delay": "300ms",
      "--tooltip-close-delay": "0ms",
      ...vars("light")
    },
    "html.dark, html[data-theme='dark']": vars("dark")
  });
});
