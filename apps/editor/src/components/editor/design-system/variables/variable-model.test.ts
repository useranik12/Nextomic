import { NO_COLOR_OPTIONS, mainFramework } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { buildCategories, buildRows, filterRows, guessVariableType } from "./variable-model";

const project = [
  { name: "gap", type: "size" as const, group: "Layout", value: "1rem" },
  { name: "brand", type: "color" as const, group: "General", value: "#fff" }
];
const base = {
  include: "",
  exclude: "",
  sort: "name" as const,
  filter: "all" as const,
  category: null
};

describe("variable manager model", () => {
  it("guesses the type of a typed value", () => {
    expect(guessVariableType("#0066ff")).toBe("color");
    expect(guessVariableType("1.5rem")).toBe("size");
    expect(guessVariableType("clamp(1rem, 2vw, 2rem)")).toBe("size");
    expect(guessVariableType("400")).toBe("number");
    expect(guessVariableType("hello")).toBe("string");
  });

  it("combines project and framework variables with badges", () => {
    const fw = mainFramework();
    const rows = buildRows(project, {
      ...fw,
      colorOptions: { ...fw.colorOptions, primary: { ...NO_COLOR_OPTIONS, dark: true } }
    });
    const primary = rows.find((r) => r.cssName === "--primary");
    expect(primary).toMatchObject({
      source: "framework",
      badge: "COLORS",
      category: "Brand",
      readOnly: false
    });
    expect(rows.find((r) => r.cssName === "--primary-d-1")?.readOnly).toBe(true);
    expect(rows.find((r) => r.cssName === "--text-m")).toMatchObject({
      badge: "SCALE",
      category: "Typography",
      readOnly: true
    });
    expect(rows.find((r) => r.cssName === "--nxt-gap")).toMatchObject({
      source: "project",
      readOnly: false
    });
  });

  it("lists categories with counts and empty project categories", () => {
    const cats = buildCategories(buildRows(project, mainFramework()), ["Empty"]);
    expect(cats.find((c) => c.name === "Layout")?.count).toBe(1);
    expect(cats.find((c) => c.name === "Empty")?.count).toBe(0);
    expect(cats.find((c) => c.name === "Typography")?.badge).toBe("SCALE");
    expect(cats[0]?.source).toBe("project");
  });

  it("filters, excludes and sorts", () => {
    const rows = buildRows(project, null);
    expect(filterRows(rows, { ...base, include: "gap" }, {}).map((r) => r.name)).toEqual(["gap"]);
    expect(filterRows(rows, { ...base, exclude: "gap" }, {}).map((r) => r.name)).toEqual(["brand"]);
    expect(filterRows(rows, { ...base, filter: "color" }, {}).map((r) => r.name)).toEqual([
      "brand"
    ]);
    expect(filterRows(rows, { ...base, filter: "unused" }, { gap: 2 }).map((r) => r.name)).toEqual([
      "brand"
    ]);
    expect(filterRows(rows, { ...base, sort: "name-desc" }, {}).map((r) => r.name)).toEqual([
      "gap",
      "brand"
    ]);
    expect(
      filterRows(rows, { ...base, category: "project:Layout" }, {}).map((r) => r.name)
    ).toEqual(["gap"]);
  });
});
