import { describe, expect, it } from "vitest";
import {
  FRAMEWORK_CATEGORY,
  UNCATEGORIZED,
  buildClassRows,
  classCategories,
  filterClassRows,
  moveClassMeta,
  withClassMeta,
  type ClassQuery
} from "./class-model";

const styles = { breakpoints: { base: { default: { color: "red" } } } };
const rows = buildClassRows({
  classes: { card: styles, hero: { breakpoints: {} }, btn: styles },
  meta: { card: { category: "Layout" }, btn: { locked: true } },
  local: { card: 2, extra: 1 },
  others: { card: 1 },
  framework: ["bg-primary", "card"]
});
const base: ClassQuery = { include: "", exclude: "", sort: "name", filter: "all", category: null };

describe("class manager model", () => {
  it("combines styled classes, used classes and framework classes", () => {
    expect(rows.find((r) => r.name === "card")).toMatchObject({
      used: 3,
      category: "Layout",
      hasStyles: true
    });
    expect(rows.find((r) => r.name === "extra")).toMatchObject({ used: 1, hasStyles: false });
    expect(rows.find((r) => r.name === "hero")?.hasStyles).toBe(false);
    expect(rows.find((r) => r.name === "bg-primary")?.source).toBe("framework");
    expect(rows.filter((r) => r.name === "card")).toHaveLength(1);
  });

  it("builds categories", () => {
    const cats = classCategories(rows, ["Empty"]);
    expect(cats.find((c) => c.id === UNCATEGORIZED)?.count).toBe(3);
    expect(cats.find((c) => c.id === "Layout")?.count).toBe(1);
    expect(cats.find((c) => c.id === "Empty")?.count).toBe(0);
    expect(cats.find((c) => c.id === FRAMEWORK_CATEGORY)?.count).toBe(1);
  });

  it("filters by category, name, usage and lock", () => {
    const names = (q: Partial<typeof base>) =>
      filterClassRows(rows, { ...base, ...q }).map((r) => r.name);
    expect(names({})).toEqual(["btn", "card", "extra", "hero"]);
    expect(names({ category: "Layout" })).toEqual(["card"]);
    expect(names({ category: UNCATEGORIZED })).toEqual(["btn", "extra", "hero"]);
    expect(names({ category: FRAMEWORK_CATEGORY })).toEqual(["bg-primary"]);
    expect(names({ include: "c", exclude: "ex" })).toEqual(["card"]);
    expect(names({ filter: "locked" })).toEqual(["btn"]);
    expect(names({ filter: "unused" })).toEqual(["btn", "hero"]);
    expect(names({ filter: "empty" })).toEqual(["extra", "hero"]);
    expect(names({ sort: "used" })[0]).toBe("card");
    expect(names({ include: "bg" })).toEqual(["bg-primary"]);
  });

  it("updates and moves meta", () => {
    let meta = withClassMeta({}, "a", { category: "X" });
    meta = withClassMeta(meta, "a", { locked: true });
    expect(meta.a).toEqual({ category: "X", locked: true });
    meta = withClassMeta(meta, "a", { category: null, locked: false });
    expect(meta.a).toBeUndefined();
    expect(moveClassMeta({ a: { locked: true } }, "a", "b")).toEqual({ b: { locked: true } });
    expect(moveClassMeta({ a: { locked: true } }, "a", null)).toEqual({});
  });
});
