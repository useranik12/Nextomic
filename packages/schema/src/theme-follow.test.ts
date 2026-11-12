import { describe, expect, it } from "vitest";
import { mainFramework } from "./main-framework";
import { applyScale, scaleKind, type Framework } from "./framework";
import {
  themeBootScript,
  themeChoices,
  themeCss,
  themeListSchema,
  newTheme,
  type Theme
} from "./theme";
import { actionDisabledReason, getAction, SET_THEME_UNAVAILABLE } from "./actions";
import {
  canSwitchThemes,
  darkModeLocked,
  diffFollower,
  effectiveFramework,
  effectiveTheme,
  startFollowing,
  stopFollowing,
  switchableThemes,
  themeSwitching,
  withFramework,
  STRUCTURE_FOLLOWS
} from "./theme-follow";

function setup(primaryDark = true) {
  const fw = mainFramework();
  const main: Theme = { ...newTheme("a", "Main", []), framework: fw, darkMode: primaryDark };
  const alt: Theme = startFollowing({ ...newTheme("b", "Alt", [main]), darkMode: false });
  return { main, alt, themes: [main, alt] };
}
const colorVar = (fw: Framework) => {
  const v = fw.variables.find((x) => /^#|^rgb|^hsl/i.test(x.value));
  if (!v) throw new Error("no color variable in main framework");
  return v;
};
const setValue = (fw: Framework, name: string, value: string): Framework => ({
  ...fw,
  variables: fw.variables.map((x) => (x.name === name ? { ...x, value } : x))
});

describe("follow primary", () => {
  it("a follower reads the primary framework live", () => {
    const { main, alt, themes } = setup();
    expect(effectiveFramework(alt, themes)).toEqual(main.framework);
    const v = colorVar(main.framework!);
    const changed: Theme = { ...main, framework: setValue(main.framework!, v.name, "#123456") };
    const after = effectiveFramework(alt, [changed, alt]);
    expect(after?.variables.find((x) => x.name === v.name)?.value).toBe("#123456");
  });

  it("an override survives a primary edit and an edit back drops it", () => {
    const { main, alt, themes } = setup();
    const fw = effectiveFramework(alt, themes)!;
    const v = colorVar(fw);
    const next = withFramework(alt, themes, setValue(fw, v.name, "#abcdef"));
    expect(typeof next).not.toBe("string");
    const alt2 = next as Theme;
    expect(alt2.overrides.variables[v.name]).toEqual({ value: "#abcdef" });
    expect(Object.keys(alt2.overrides.variables)).toHaveLength(1);
    // the primary edits another variable: the override stays, the new value arrives
    const other = main.framework!.variables.find((x) => x.name !== v.name)!;
    const main2: Theme = { ...main, framework: setValue(main.framework!, other.name, "9px") };
    const live = effectiveFramework(alt2, [main2, alt2])!;
    expect(live.variables.find((x) => x.name === v.name)?.value).toBe("#abcdef");
    expect(live.variables.find((x) => x.name === other.name)?.value).toBe("9px");
    // back to the primary's value: no override left
    const back = withFramework(alt2, themes, main.framework!) as Theme;
    expect(back.overrides.variables).toEqual({});
  });

  it("a dark value is an override", () => {
    const { alt, themes } = setup();
    const fw = effectiveFramework(alt, themes)!;
    const v = fw.variables[0]!;
    const set = withFramework(alt, themes, {
      ...fw,
      variables: fw.variables.map((x) => (x === v ? { ...x, dark: "#000000" } : x))
    }) as Theme;
    expect(set.overrides.variables[v.name]).toEqual({ dark: "#000000" });
    expect(effectiveFramework(set, themes)?.variables[0]?.dark).toBe("#000000");
  });

  it("a scale edit stores a scale override, not a variable per step", () => {
    const { alt, themes } = setup();
    const fw = effectiveFramework(alt, themes)!;
    const scale = fw.scales.find((s) => scaleKind(s) === "space")!;
    const edited = applyScale(fw, { ...scale, baseMax: scale.baseMax + 2 });
    const next = withFramework(alt, themes, edited) as Theme;
    expect(next.overrides.scales[scale.prefix]).toEqual({ baseMax: scale.baseMax + 2 });
    expect(next.overrides.variables).toEqual({});
    expect(effectiveFramework(next, themes)).toEqual(edited);
  });

  it("refuses structural edits", () => {
    const { alt, themes } = setup();
    const fw = effectiveFramework(alt, themes)!;
    const bad = [
      { ...fw, variables: [...fw.variables, { name: "extra", value: "1px" }] },
      { ...fw, variables: fw.variables.slice(1) },
      { ...fw, css: `${fw.css}.x{}` },
      { ...fw, colorPrefix: "zz-" }
    ];
    for (const next of bad) {
      expect(diffFollower(alt, themes, next)).toEqual({ ok: false, error: STRUCTURE_FOLLOWS });
      expect(withFramework(alt, themes, next)).toBe(STRUCTURE_FOLLOWS);
    }
    expect(withFramework(alt, themes, null)).toBe(STRUCTURE_FOLLOWS);
  });

  it("orphan overrides are ignored when the primary drops a variable", () => {
    const { main, alt } = setup();
    const ghost: Theme = {
      ...alt,
      overrides: { variables: { gone: { value: "1px" } }, scales: { nope: { baseMin: 3 } } }
    };
    expect(effectiveFramework(ghost, [main, ghost])).toEqual(main.framework);
  });

  it("dark mode is on and locked while the primary has it", () => {
    const { alt, themes } = setup(true);
    expect(effectiveTheme(alt, themes).darkMode).toBe(true);
    expect(darkModeLocked(alt, themes)).toBe(true);
    const off = setup(false);
    expect(effectiveTheme(off.alt, off.themes).darkMode).toBe(false);
    expect(darkModeLocked(off.alt, off.themes)).toBe(false);
    expect(effectiveTheme({ ...off.alt, darkMode: true }, off.themes).darkMode).toBe(true);
  });

  it("project variable overrides merge over the primary per mode", () => {
    const { main, alt } = setup();
    const m: Theme = { ...main, variables: { brand: { light: "red", dark: "maroon" } } };
    const a: Theme = { ...alt, variables: { brand: { light: "blue" } } };
    expect(effectiveTheme(a, [m, a]).variables.brand).toEqual({ light: "blue", dark: "maroon" });
  });

  it("a follower renders the primary classes under its own slug", () => {
    const { alt, themes } = setup();
    expect(themeCss(effectiveTheme(alt, themes))).toContain(`[data-nxt-theme="${alt.slug}"]`);
  });

  it("stopping keeps the look: the effective values become the theme's own", () => {
    const { main, alt, themes } = setup();
    const own = stopFollowing(alt, themes);
    expect(own.followPrimary).toBe(false);
    expect(own.framework).toEqual(main.framework);
    expect(own.overrides).toEqual({ variables: {}, scales: {} });
  });

  it("starting replaces the theme's own framework and overrides", () => {
    const { main } = setup();
    const own: Theme = {
      ...newTheme("c", "C", [main]),
      framework: mainFramework(),
      variables: { x: { light: "1" } }
    };
    const on = startFollowing(own);
    expect(on.framework).toBeNull();
    expect(on.variables).toEqual({});
  });

  it("the default theme cannot follow", () => {
    const { main, alt } = setup();
    expect(themeListSchema.safeParse([{ ...main, followPrimary: true }, alt]).success).toBe(false);
    expect(themeListSchema.safeParse([main, alt]).success).toBe(true);
  });

  it("set theme needs the primary plus an active follower", () => {
    const { main, alt, themes } = setup();
    expect(switchableThemes(themes).map((t) => t.id)).toEqual(["a", "b"]);
    expect(canSwitchThemes(themes)).toBe(true);
    expect(canSwitchThemes([main])).toBe(false);
    expect(canSwitchThemes([main, { ...alt, active: false }])).toBe(false);
    expect(canSwitchThemes([main, { ...alt, followPrimary: false }])).toBe(false);
  });
});

describe("switching on a page", () => {
  it("ships the other switchable themes unless the page forces its theme", () => {
    const { main, alt, themes } = setup();
    expect(themeSwitching(themes, main, false).map((t) => t.id)).toEqual(["b"]);
    expect(themeSwitching(themes, alt, false).map((t) => t.id)).toEqual(["a"]);
    expect(themeSwitching(themes, main, true)).toEqual([]);
  });

  it("ships nothing for a theme that is neither the primary nor a follower", () => {
    const { main, alt } = setup();
    const own: Theme = { ...newTheme("c", "Own", [main, alt]), isDefault: false };
    expect(themeSwitching([main, alt, own], own, false)).toEqual([]);
    expect(themeSwitching([main], main, false)).toEqual([]);
  });

  it("hands the others as rendered (a follower carries the primary framework)", () => {
    const { main, themes } = setup();
    expect(themeSwitching(themes, main, false)[0]?.framework).toEqual(main.framework);
  });

  it("lists choices with their modes", () => {
    const { themes } = setup(true);
    expect(themeChoices(themes)).toEqual([
      { id: "a", slug: "main", name: "Main", modes: ["light", "dark"], defaultMode: "light" },
      { id: "b", slug: "alt", name: "Alt", modes: ["light", "dark"], defaultMode: "light" }
    ]);
  });

  it("only the switch-ready project makes Set Theme available", () => {
    const { main, alt, themes } = setup();
    const set = getAction("theme.set")!;
    expect(actionDisabledReason(set, { themes })).toBeNull();
    expect(actionDisabledReason(set, { themes: [main] })).toBe(SET_THEME_UNAVAILABLE);
    expect(actionDisabledReason(set, { themes: [main, { ...alt, followPrimary: false }] })).toBe(
      SET_THEME_UNAVAILABLE
    );
    expect(actionDisabledReason(set)).toBeNull();
  });

  it("the boot script reads the visitor's cookie only among shipped themes", () => {
    const { main, alt, themes } = setup();
    const plain = themeBootScript(main);
    expect(plain).not.toContain("document.cookie");
    const choice = themeBootScript(main, themeSwitching(themes, main, false));
    expect(choice).toContain("nxt-theme=");
    expect(choice).toContain("hasOwnProperty");
    expect(choice).toContain(JSON.stringify(alt.slug));
  });

  it("a switched-in theme leaves the no-mode fallback to the page's own theme", () => {
    const main = { ...setup().main, variables: { brand: { light: "red" } } };
    expect(themeCss(main)).toContain(":root:not([data-nxt-mode])");
    expect(themeCss(main, undefined, false)).not.toContain(":root:not([data-nxt-mode])");
  });
});
