import { describe, expect, it } from "vitest";
import {
  newTheme,
  resolveTheme,
  themeBootScript,
  themeCss,
  themeListSchema,
  matchRoute,
  type Theme
} from "./theme";

const make = (patch: Partial<Theme>, id: string, name: string, existing: Theme[] = []): Theme => ({
  ...newTheme(id, name, existing),
  ...patch
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

  it("matches route globs literally apart from *", () => {
    expect(matchRoute("/blog/*", "/blog/a/b")).toBe(true);
    expect(matchRoute("/a.b", "/axb")).toBe(false);
  });

  it("scopes variable overrides per mode and refuses unsafe values", () => {
    const t = {
      ...newTheme("a", "A", []),
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
