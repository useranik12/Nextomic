import { describe, expect, it } from "vitest";
import { scopeFrameworkCss } from "./framework";
import {
  newTheme,
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

describe("color modes", () => {
  it("keeps only light and dark, dropping old custom modes and their overrides", () => {
    const t = themeSchema.parse({
      id: "t",
      name: "T",
      slug: "t",
      modes: [
        { id: "light", name: "Light" },
        { id: "dark", name: "Dark" },
        { id: "sepia", name: "Sepia" }
      ],
      defaultMode: "sepia",
      variables: { bg: { light: "#fff", sepia: "#f4ecd8" } }
    });
    expect(t.modes.map((m) => m.id)).toEqual(["light", "dark"]);
    expect(t.defaultMode).toBe("light");
    expect(t.variables.bg).toEqual({ light: "#fff" });
    expect(themeCss(t)).not.toContain("sepia");
  });

  it("the boot script offers light and dark and falls back to the default", () => {
    const script = themeBootScript(theme({ defaultMode: "dark" }));
    expect(script).toContain('["light","dark"]');
    expect(script).toContain('v="dark"');
  });

  it("refuses duplicate slugs", () => {
    const one = theme({ isDefault: true }, "a", "A");
    const two = { ...theme({}, "b", "B"), slug: one.slug };
    expect(themeListSchema.safeParse([one, two]).success).toBe(false);
  });
});
