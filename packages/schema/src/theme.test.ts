import { describe, expect, it } from "vitest";
import {
  newTheme,
  resolveTheme,
  themeBootScript,
  themeCss,
  themeListSchema,
  matchRoute,
  themeConditionsSchema,
  type Theme
} from "./theme";

// Conditions are written in the old static form here: they must still read as rules.
const make = (
  patch: Partial<Omit<Theme, "conditions">> & { conditions?: unknown },
  id: string,
  name: string,
  existing: Theme[] = []
): Theme => ({
  ...newTheme(id, name, existing),
  darkMode: true,
  ...patch,
  conditions: themeConditionsSchema.parse(patch.conditions ?? { match: "any", items: [] })
});

describe("themes", () => {
  it("makes the first theme the default and later ones not", () => {
    const a = newTheme("a", "Main", []);
    const b = newTheme("b", "Main", [a]);
    expect(a.isDefault).toBe(true);
    expect(b.isDefault).toBe(false);
    expect(b.slug).toBe("main-2");
    expect(() => themeListSchema.parse([a, b])).not.toThrow();
  });

  it("requires exactly one default", () => {
    const a = newTheme("a", "A", []);
    const b = { ...newTheme("b", "B", [a]), isDefault: true };
    expect(themeListSchema.safeParse([a, b]).success).toBe(false);
  });

  it("applies the default theme to everything", () => {
    const a = newTheme("a", "A", []);
    const b = newTheme("b", "B", [a]);
    expect(resolveTheme([a, b], { pageId: "p", route: "/x" })).toEqual({
      theme: a,
      reason: "default"
    });
  });

  it("forces a theme per page over conditions", () => {
    const a = newTheme("a", "A", []);
    const b = make(
      { conditions: { match: "any", items: [{ type: "route", pattern: "/*" }] } },
      "b",
      "B",
      [a]
    );
    const c = newTheme("c", "C", [a, b]);
    expect(resolveTheme([a, b, c], { pageId: "p", route: "/x", forcedThemeId: "c" }).theme).toBe(c);
    expect(resolveTheme([a, b, c], { pageId: "p", route: "/x" }).reason).toBe("condition");
  });

  it("orders by priority, then specificity, then name", () => {
    const a = newTheme("a", "A", []);
    const route = make(
      { conditions: { match: "any", items: [{ type: "route", pattern: "/blog/*" }] } },
      "r",
      "Route",
      [a]
    );
    const page = make(
      { conditions: { match: "any", items: [{ type: "page", pageIds: ["p"] }] } },
      "pg",
      "Page",
      [a, route]
    );
    const ctx = { pageId: "p", route: "/blog/x" };
    expect(resolveTheme([a, route, page], ctx).theme?.id).toBe("pg");
    const hi = { ...route, priority: 5 };
    expect(resolveTheme([a, hi, page], ctx).theme?.id).toBe("r");
  });

  it("reads old page and route conditions as rules, and new rules as they are", () => {
    const rules = themeConditionsSchema.parse({
      match: "any",
      items: [
        { type: "route", pattern: "/blog/*" },
        { type: "route", pattern: "/about" },
        { type: "page", pageIds: ["p1", "p2"] }
      ]
    });
    expect(rules.items).toMatchObject([
      { field: "page.route", op: "startsWith", value: "/blog/" },
      { field: "page.route", op: "equals", value: "/about" },
      { field: "page.id", op: "isIn", value: "p1, p2" }
    ]);
    expect(themeConditionsSchema.parse(rules)).toEqual(rules);
    const whole = make(
      {
        conditions: {
          id: "root",
          match: "all",
          items: [{ id: "w", field: "site.whole", op: "isTrue", key: "", value: "" }]
        }
      },
      "w",
      "Whole",
      [newTheme("a", "A", [])]
    );
    expect(
      resolveTheme([newTheme("a", "A", []), whole], { pageId: "x", route: "/" }).theme?.id
    ).toBe("w");
  });

  it("matches route globs literally apart from *", () => {
    expect(matchRoute("/blog/*", "/blog/a/b")).toBe(true);
    expect(matchRoute("/a.b", "/axb")).toBe(false);
  });

  it("scopes variable overrides per mode and refuses unsafe values", () => {
    const t = {
      ...newTheme("a", "A", []),
      darkMode: true,
      variables: { bg: { light: "#fff", dark: "#000" }, bad: { dark: "red}" } }
    };
    const css = themeCss(t);
    expect(css).toContain(
      ':root[data-nxt-theme="a"][data-nxt-mode="light"],:root:not([data-nxt-mode]){--nxt-bg:#fff}'
    );
    expect(css).toContain('[data-nxt-mode="dark"]{--nxt-bg:#000}');
    expect(css).not.toContain("bad");
    expect(themeBootScript(t)).toContain('"data-nxt-theme","a"');
  });
});

describe("darkMode", () => {
  it("off removes the dark mode from the output and the boot script", () => {
    const theme = make(
      { darkMode: false, variables: { bg: { light: "#fff", dark: "#000" } }, defaultMode: "dark" },
      "t1",
      "Main"
    );
    expect(themeCss(theme)).not.toContain("dark");
    expect(themeBootScript(theme)).not.toContain('"dark"');
    expect(themeBootScript(theme)).toContain('"light"');
  });
});

describe("allowModeSwitch", () => {
  it("defaults on and reads a saved choice and the system preference", () => {
    const theme = make({ respectSystemPreference: true }, "t1", "Main");
    expect(theme.allowModeSwitch).toBe(true);
    const script = themeBootScript(theme);
    expect(script).toContain("localStorage");
    expect(script).toContain("prefers-color-scheme");
  });

  it("off locks the page to the default mode", () => {
    const theme = make(
      { allowModeSwitch: false, respectSystemPreference: true, defaultMode: "dark" },
      "t1",
      "Main"
    );
    const script = themeBootScript(theme);
    expect(script).not.toContain("localStorage");
    expect(script).not.toContain("prefers-color-scheme");
    expect(script).toContain('"dark"');
  });
});

describe("active", () => {
  it("never applies an inactive theme, whatever picks it", () => {
    const a = make({ isDefault: true, active: false }, "a", "A");
    const b = make(
      {
        isDefault: false,
        conditions: { match: "any", items: [{ type: "page", pageIds: ["p1"] }] }
      },
      "b",
      "B",
      [a]
    );
    expect(resolveTheme([a, b], { pageId: "p2", route: "/x" }).theme).toBeNull();
    expect(resolveTheme([a, b], { pageId: "p1", route: "/x" }).theme?.id).toBe("b");
    expect(
      resolveTheme([a, { ...b, active: false }], { pageId: "p1", route: "/x", forcedThemeId: "b" })
        .theme
    ).toBeNull();
  });
});
