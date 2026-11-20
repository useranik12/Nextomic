import { describe, expect, it } from "vitest";
import { buildDynamicContext } from "./dynamic-context";
import { elementNodeSchema, type ElementNode } from "./element";
import { defaultPageSettings } from "./page";
import {
  DEFAULT_COUNT_TEXT,
  countText,
  matchesSearch,
  maxChipsOf,
  searchKey,
  selectDisplayOf,
  selectProblems,
  startChoices
} from "./select";
import { formProblems, isMultiple, valueKindOf, withFormDefaults } from "./forms";
import { designPartsFor, parseFormDesignKey, FORM_DESIGN_PARTS } from "./choice-design";
import { editStateLabel, editStatesFor } from "./edit-state";
import { canHaveQuery } from "./query";

const el = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: unknown[] = []
): ElementNode =>
  elementNodeSchema.parse({ id, type, props, children, styles: { breakpoints: {} } });
const option = (label: string, props: Record<string, unknown> = {}) =>
  el(`o-${label}`, "option", { label, ...props });
const select = (props: Record<string, unknown>, kids: ElementNode[]) =>
  el("s", "select", { name: "pick", ...props }, kids);
const page = (root: ElementNode) => el("p", "page", {}, [el("f", "form", { name: "s" }, [root])]);

describe("searching the options", () => {
  it("ignores case, accents and extra spaces", () => {
    expect(searchKey("  Café   Crème ")).toBe("cafe creme");
    expect(matchesSearch("Café Crème", "cafe")).toBe(true);
    expect(matchesSearch("Café Crème", "CRÈME ca")).toBe(true);
  });

  it("needs every typed word, and an empty search matches all", () => {
    expect(matchesSearch("United Kingdom", "united fr")).toBe(false);
    expect(matchesSearch("United Kingdom", "kingdom unit")).toBe(true);
    expect(matchesSearch("anything", "   ")).toBe(true);
  });
});

describe("select settings", () => {
  it("falls back to chips and three chips", () => {
    expect(selectDisplayOf("nonsense")).toBe("chips");
    expect(selectDisplayOf("count")).toBe("count");
    expect(maxChipsOf("")).toBe(3);
    expect(maxChipsOf("5")).toBe(5);
    expect(maxChipsOf("99")).toBe(3);
    expect(maxChipsOf("1.5")).toBe(3);
  });

  it("writes the count into its text", () => {
    expect(countText("", 4)).toBe("4 selected");
    expect(countText("{count} of 9", 2)).toBe("2 of 9");
    expect(DEFAULT_COUNT_TEXT).toContain("{count}");
  });

  it("starts with the options chosen at the start (plain text only)", () => {
    const node = select({}, [
      option("A", { selected: true }),
      option("B", { value: "bee", selected: true }),
      option("C")
    ]);
    expect(startChoices(node)).toEqual([
      { value: "A", label: "A" },
      { value: "bee", label: "B" }
    ]);
  });
});

describe("select value", () => {
  const kids = [option("A", { selected: true }), option("B", { value: "bee", selected: true })];
  const blank = buildDynamicContext({
    page: { name: "P", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });

  it("holds one value, or a list when several can be chosen", () => {
    const single = select({}, kids);
    expect(isMultiple(single)).toBe(false);
    expect(valueKindOf(single)).toBe("text");
    expect(withFormDefaults(blank, page(single)).forms.s?.pick).toBe("A");
    const many = select({ multiple: true }, kids);
    expect(isMultiple(many)).toBe(true);
    expect(valueKindOf(many)).toBe("many");
    const out = withFormDefaults(blank, page(many));
    expect(out.forms.s?.pick).toBe('["A","bee"]');
    expect(out.types["form.s.pick"]?.isList).toBe(true);
  });

  it("can take its options from a query like the other option fields", () => {
    expect(canHaveQuery("select")).toBe(true);
  });
});

describe("select problems", () => {
  it("refuses an option with neither label nor value", () => {
    const bad = select({}, [option("", { icon: "star" })]);
    expect(selectProblems(bad)).toHaveLength(1);
    expect(formProblems(page(bad)).some((p) => p.includes("no label and no value"))).toBe(true);
    expect(selectProblems(select({}, [option("", { value: "x" })]))).toEqual([]);
  });

  it("checks nothing on other elements", () => {
    expect(selectProblems(el("r", "radio", { name: "r" }, [option("")]))).toEqual([]);
  });
});

describe("select design", () => {
  it("has its own Design group with unique part ids", () => {
    const ids = designPartsFor("select").map((part) => part.id);
    expect(ids).toContain("opt");
    expect(ids).toContain("chip");
    expect(ids).toContain("menu");
    expect(new Set(ids).size).toBe(ids.length);
    const all = FORM_DESIGN_PARTS.map((part) => part.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("reads the keys of its parts, and refuses a state a part does not have", () => {
    expect(parseFormDesignKey("--nxt-ip-opt-background-color-checked")?.state).toBe("checked");
    expect(parseFormDesignKey("--nxt-ip-opt-background-color-error")).toBeNull();
    expect(parseFormDesignKey("--nxt-ip-chip-color")?.part.id).toBe("chip");
    expect(parseFormDesignKey("--nxt-ip-menu-max-height")).toBeNull();
  });

  it("is edited in the states of its options", () => {
    expect(editStatesFor("select")).toEqual(
      expect.arrayContaining(["checked", "error", "success"])
    );
    expect(editStateLabel("select", "checked")).toBe("Selected");
  });
});
