import { describe, expect, it } from "vitest";
import {
  countVariableUsageInTree,
  renameVariableInTree,
  type ElementNode,
  colorShades,
  countVariableRefs,
  fluidClamp,
  renameVariableRef,
  spaceScale,
  typeScale,
  variableListSchema,
  variablesCss
} from "./index";

describe("fluid sizes", () => {
  it("builds a clamp that grows between the viewports", () => {
    expect(fluidClamp({ min: 16, max: 20, minViewport: 320, maxViewport: 1240 })).toBe(
      "clamp(1rem, 0.913rem + 0.435vw, 1.25rem)"
    );
  });

  it("collapses to a fixed size when min equals max", () => {
    expect(fluidClamp({ min: 16, max: 16, minViewport: 320, maxViewport: 1240 })).toBe("1rem");
  });
});

describe("scales", () => {
  const type = typeScale({
    baseMin: 16,
    baseMax: 20,
    ratioMin: 1.2,
    ratioMax: 1.25,
    minViewport: 320,
    maxViewport: 1240,
    stepsDown: 2,
    stepsUp: 3
  });

  it("orders the type scale small to large around text-m", () => {
    expect(type.map((v) => v.name)).toEqual([
      "text-xs",
      "text-s",
      "text-m",
      "text-l",
      "text-xl",
      "text-2xl"
    ]);
    expect(type.find((v) => v.name === "text-m")?.fluid?.min).toBe(16);
    expect(type.find((v) => v.name === "text-l")?.fluid?.max).toBe(25);
  });

  it("builds the spacing scale from the base", () => {
    const space = spaceScale({ baseMin: 16, baseMax: 20, minViewport: 320, maxViewport: 1240 });
    expect(space).toHaveLength(9);
    expect(space.find((v) => v.name === "space-s")?.fluid).toMatchObject({ min: 16, max: 20 });
    expect(space.find((v) => v.name === "space-3xs")?.fluid).toMatchObject({ min: 4, max: 5 });
  });

  it("makes eleven shades and keeps the base as 500", () => {
    const shades = colorShades("brand", "#0066ff");
    expect(shades).toHaveLength(11);
    expect(shades.find((v) => v.name === "brand-500")?.value).toBe("#0066ff");
    expect(shades[0]?.value).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("variables in CSS", () => {
  it("writes custom properties and skips unsafe values", () => {
    const css = variablesCss([
      { name: "brand", type: "color", group: "Colors", value: "#06f" },
      { name: "bad", type: "string", group: "x", value: "red;} body{display:none" }
    ]);
    expect(css).toBe(":root{--nxt-brand:#06f}");
  });

  it("rejects duplicate names and unsafe values in the schema", () => {
    const v = { name: "a", type: "number", group: "g", value: "1" };
    expect(variableListSchema.safeParse([v, v]).success).toBe(false);
    expect(variableListSchema.safeParse([{ ...v, value: "1;}" }]).success).toBe(false);
  });

  it("renames and counts references", () => {
    const css = "color: var(--nxt-brand); border-color: var(--nxt-brand, red)";
    expect(countVariableRefs(css, "brand")).toBe(2);
    expect(renameVariableRef(css, "brand", "accent")).toBe(
      "color: var(--nxt-accent); border-color: var(--nxt-accent, red)"
    );
  });
});

describe("variable references in trees", () => {
  const node = (css: string): ElementNode => ({
    id: "a",
    type: "container",
    classIds: [],
    props: {},
    styles: { breakpoints: { base: { default: { color: css } } }, raw: ".x{gap:var(--nxt-gap)}" },
    actions: {},
    children: []
  });

  it("counts and renames across style values and raw CSS", () => {
    const root = node("var(--nxt-brand)");
    expect(countVariableUsageInTree(root)).toEqual({ brand: 1, gap: 1 });
    expect(renameVariableInTree(root, "gap", "space-m")).toBe(true);
    expect(root.styles.raw).toBe(".x{gap:var(--nxt-space-m)}");
    expect(renameVariableInTree(root, "missing", "x")).toBe(false);
  });
});
