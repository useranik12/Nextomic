import { describe, expect, it } from "vitest";
import { scopeFrameworkCss } from "./framework";
import {
  addThemeMode,
  newTheme,
  removeThemeMode,
  themeBootScript,
  themeCss,
  themeListSchema,
  themeSchema,
  type Theme
} from "./theme";

const theme = (patch: Partial<Theme>, id = "a", name = "A"): Theme => ({
  ...newTheme(id, name, []),
  darkMode: true,
  ...patch
});

describe("framework CSS scoping", () => {
  const css =
    ":root{--x:1} html[data-nxt-mode=dark]{--x:2} .btn{color:red} a:hover,.card>p{margin:0}";

  it("puts root rules under the theme attribute and the rest at zero specificity", () => {
    const out = scopeFrameworkCss(css, "brand");
    expect(out).toContain(':root[data-nxt-theme="brand"]{--x:1}');
    expect(out).toContain(':root[data-nxt-theme="brand"][data-nxt-mode=dark]{--x:2}');
    expect(out).toContain(':where(:root[data-nxt-theme="brand"]) .btn{color:red}');
    expect(out).toContain(':where(:root[data-nxt-theme="brand"]) a:hover');
    expect(out).toContain(':where(:root[data-nxt-theme="brand"]) .card>p');
  });

  it("does not scope keyframe steps and returns nothing for broken CSS", () => {
    const out = scopeFrameworkCss("@keyframes spin{from{opacity:0}to{opacity:1}}", "brand");
    expect(out).toContain("from{opacity:0}");
    expect(out).not.toContain(":where(:root");
    expect(scopeFrameworkCss("   ", "brand")).toBe("");
    expect(scopeFrameworkCss(".a{", "brand")).toBe("");
  });

  it("keeps two themes apart", () => {
    const a = scopeFrameworkCss(".btn{color:red}", "one");
    const b = scopeFrameworkCss(".btn{color:red}", "two");
    expect(a).toContain('data-nxt-theme="one"');
    expect(a).not.toContain('"two"');
    expect(b).toContain('data-nxt-theme="two"');
  });
});

describe("custom color modes", () => {
  const modes = [
    { id: "light", name: "Light" },
    { id: "dark", name: "Dark" },
    { id: "sepia", name: "Sepia" }
  ];

  it("writes one rule per mode and only the default mode also applies without a mode set", () => {
    const t = theme({
      modes,
      variables: { bg: { light: "#fff", dark: "#000", sepia: "#f4ecd8" } }
    });
    const css = themeCss(t);
    expect(css).toContain('[data-nxt-mode="sepia"]{--nxt-bg:#f4ecd8}');
    expect(css.match(/:root:not\(\[data-nxt-mode\]\)/g)).toHaveLength(1);
  });

  it("skips a mode that has no overrides", () => {
    const t = theme({ modes, variables: { bg: { sepia: "#f4ecd8" } } });
    const css = themeCss(t);
    expect(css).not.toContain('data-nxt-mode="light"');
    expect(css).not.toContain('data-nxt-mode="dark"');
  });

  it("the boot script accepts the custom mode and falls back to the default", () => {
    const script = themeBootScript(theme({ modes, defaultMode: "sepia" }));
    expect(script).toContain('["light","dark","sepia"]');
    expect(script).toContain('v="sepia"');
  });

  it("refuses a default mode that is not one of the modes and duplicate slugs", () => {
    expect(
      themeListSchema.safeParse([theme({ modes, defaultMode: "night", isDefault: true })]).success
    ).toBe(false);
    const one = theme({ isDefault: true }, "a", "A");
    const two = { ...theme({}, "b", "B"), slug: one.slug };
    expect(themeListSchema.safeParse([one, two]).success).toBe(false);
  });
});

describe("theme mode helpers", () => {
  const base = themeSchema.parse({ id: "t", name: "T", slug: "t", darkMode: true });

  it("adds a custom mode with a unique id and caps at 6", () => {
    const one = addThemeMode(base, "Sepia");
    expect(one?.modes.map((m) => m.id)).toEqual(["light", "dark", "sepia"]);
    const two = addThemeMode(one!, "Sepia");
    expect(two?.modes.at(-1)?.id).toBe("sepia-2");
    expect(addThemeMode(base, "  ")).toBeNull();
    let full: typeof base | null = base;
    for (const n of ["a", "b", "c", "d"]) full = addThemeMode(full!, n);
    expect(full?.modes).toHaveLength(6);
    expect(addThemeMode(full!, "e")).toBeNull();
  });

  it("removes a custom mode with its overrides, never a built-in one", () => {
    const withMode = addThemeMode(base, "Sepia")!;
    const set = {
      ...withMode,
      defaultMode: "sepia",
      variables: { bg: { light: "#fff", sepia: "#f4ecd8" } }
    };
    const out = removeThemeMode(set, "sepia");
    expect(out.modes.map((m) => m.id)).toEqual(["light", "dark"]);
    expect(out.defaultMode).toBe("light");
    expect(out.variables.bg).toEqual({ light: "#fff" });
    expect(removeThemeMode(set, "dark")).toBe(set);
  });

  it("emits css for a custom mode", () => {
    const withMode = addThemeMode(base, "Sepia")!;
    const css = themeCss({ ...withMode, variables: { bg: { sepia: "#f4ecd8" } } }, new Set());
    expect(css).toContain('data-nxt-mode="sepia"');
    expect(css).toContain("#f4ecd8");
  });
});
