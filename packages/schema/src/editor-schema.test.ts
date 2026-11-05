import { describe, expect, it } from "vitest";
import {
  DEFAULT_BREAKPOINTS,
  HTML_ID_PREFIX,
  breakpointCascade,
  breakpointListSchema,
  collectHtmlIds,
  createPageInputSchema,
  elementNodeSchema,
  emptyPageTree,
  generateHtmlId,
  projectSettingsSchema,
  savePageInputSchema
} from "./index";

describe("breakpoints", () => {
  it("defaults to desktop 1440, tablet 768, mobile 375 previews", () => {
    expect(DEFAULT_BREAKPOINTS.map((b) => b.previewWidth)).toEqual([1440, 768, 375]);
    expect(breakpointListSchema.parse(DEFAULT_BREAKPOINTS)).toHaveLength(3);
  });

  it("requires exactly one base and unique names and widths", () => {
    const noBase = DEFAULT_BREAKPOINTS.filter((b) => b.kind !== "base");
    expect(breakpointListSchema.safeParse(noBase).success).toBe(false);
    const dupName = [...DEFAULT_BREAKPOINTS, { ...DEFAULT_BREAKPOINTS[1]!, id: "t2", width: 800 }];
    expect(breakpointListSchema.safeParse(dupName).success).toBe(false);
    const dupWidth = [
      ...DEFAULT_BREAKPOINTS,
      { ...DEFAULT_BREAKPOINTS[1]!, id: "t2", name: "Other" }
    ];
    expect(breakpointListSchema.safeParse(dupWidth).success).toBe(false);
  });

  it("caps the list at 8", () => {
    const many = [
      DEFAULT_BREAKPOINTS[0]!,
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `b${i}`,
        name: `B${i}`,
        icon: "ph:desktop",
        kind: "down" as const,
        width: 300 + i
      }))
    ];
    expect(breakpointListSchema.safeParse(many).success).toBe(false);
  });

  it("orders the cascade base, up ascending, down descending", () => {
    const list = breakpointListSchema.parse([
      ...DEFAULT_BREAKPOINTS,
      { id: "wide", name: "Wide", icon: "ph:desktop", kind: "up", width: 1600 },
      { id: "large", name: "Large", icon: "ph:desktop", kind: "up", width: 1200 }
    ]);
    expect(breakpointCascade(list).map((b) => b.id)).toEqual([
      "base",
      "large",
      "wide",
      "tablet",
      "mobile"
    ]);
  });
});

describe("element ids", () => {
  it("generates nxtomc- plus 8 a-z0-9, unique among taken ids", () => {
    const id = generateHtmlId(new Set());
    expect(id).toMatch(/^nxtomc-[a-z0-9]{8}$/);
    const fixed = () => 0;
    const first = generateHtmlId(new Set(), fixed);
    expect(first).toBe(`${HTML_ID_PREFIX}aaaaaaaa`);
    let calls = 0;
    const next = generateHtmlId(new Set([first]), () => (calls++ < 8 ? 0 : 0.5));
    expect(next).not.toBe(first);
  });

  it("collects html ids across the tree", () => {
    const tree = emptyPageTree();
    tree.children.push({ ...emptyPageTree(), htmlId: "nxtomc-abcd1234", type: "section" });
    expect([...collectHtmlIds(tree)]).toEqual(["nxtomc-abcd1234"]);
  });
});

describe("page schemas", () => {
  it("fills defaults on a minimal element node", () => {
    const node = elementNodeSchema.parse({
      id: "a",
      type: "section",
      children: [{ id: "b", type: "text" }]
    });
    expect(node.classIds).toEqual([]);
    expect(node.children[0]?.styles).toEqual({ breakpoints: {} });
  });

  it("validates routes", () => {
    expect(createPageInputSchema.safeParse({ name: "About", route: "/about" }).success).toBe(true);
    expect(createPageInputSchema.safeParse({ name: "About", route: "about" }).success).toBe(false);
    expect(createPageInputSchema.safeParse({ name: "About", route: "/a b" }).success).toBe(false);
  });

  it("requires baseVersion on save", () => {
    expect(savePageInputSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(savePageInputSchema.safeParse({ baseVersion: 1, name: "x" }).success).toBe(true);
  });

  it("applies project settings defaults", () => {
    const settings = projectSettingsSchema.parse({});
    expect(settings.generateElementIds).toBe(true);
    expect(settings.breakpoints).toHaveLength(3);
  });
});
