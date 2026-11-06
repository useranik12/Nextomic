import { describe, expect, it } from "vitest";
import { scopeFrameworkCss } from "./framework";
import { newTheme, themeBootScript, themeCss, themeListSchema, type Theme } from "./theme";

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
