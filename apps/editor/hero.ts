import { heroui } from "@heroui/theme";
import tokens from "../../blueprint/tokens.json" with { type: "json" };

// blueprint/tokens.json is the single source of truth for builder UI colors (see
// docs/design-system.md "Design sources"). Never hand-duplicate these hex values —
// if the Figma sheet changes, update tokens.json and this file picks it up automatically.
function colorScale(mode: "dark" | "light", name: keyof typeof tokens.modes.dark.colors) {
  return tokens.modes[mode].colors[name];
}

const plugin: unknown = heroui({
  defaultTheme: tokens.meta.defaultMode as "dark",
  themes: {
    dark: {
      colors: {
        background: tokens.modes.dark.layout.background,
        foreground: tokens.modes.dark.layout.foreground,
        divider: tokens.modes.dark.layout.divider,
        focus: tokens.modes.dark.layout.focus,
        content1: tokens.modes.dark.content.content1,
        content2: tokens.modes.dark.content.content2,
        content3: tokens.modes.dark.content.content3,
        content4: tokens.modes.dark.content.content4,
        default: colorScale("dark", "default"),
        primary: colorScale("dark", "primary"),
        secondary: colorScale("dark", "secondary"),
        success: colorScale("dark", "success"),
        warning: colorScale("dark", "warning"),
        danger: colorScale("dark", "danger")
      }
    },
    light: {
      colors: {
        background: tokens.modes.light.layout.background,
        foreground: tokens.modes.light.layout.foreground,
        divider: tokens.modes.light.layout.divider,
        focus: tokens.modes.light.layout.focus,
        content1: tokens.modes.light.content.content1,
        content2: tokens.modes.light.content.content2,
        content3: tokens.modes.light.content.content3,
        content4: tokens.modes.light.content.content4,
        default: colorScale("light", "default"),
        primary: colorScale("light", "primary"),
        secondary: colorScale("light", "secondary"),
        success: colorScale("light", "success"),
        warning: colorScale("light", "warning"),
        danger: colorScale("light", "danger")
      }
    }
  }
});

export default plugin;
