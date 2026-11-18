import { describe, expect, it } from "vitest";
import {
  COUNTER_PARTS,
  decimalsOf,
  designPartsFor,
  editStatesFor,
  formProblems,
  holdNumber,
  inputDesignKey,
  inputPartSelectors,
  parseFormDesignKey,
  numberSpecOf,
  numberTypeOf,
  stepNumber,
  withFormDefaults,
  buildDynamicContext,
  defaultPageSettings,
  type ElementNode
} from "./index";

const props = (p: Record<string, string>) => (key: string) => p[key] ?? "";
const el = (
  id: string,
  type: string,
  p: Record<string, unknown> = {},
  children: ElementNode[] = []
) =>
  ({
    id,
    type,
    classIds: [],
    props: p,
    styles: { breakpoints: {} },
    actions: {},
    children
  }) as ElementNode;

describe("number rules", () => {
  it("holds a value inside the limits and never empty", () => {
    const spec = numberSpecOf(props({ min: "1", max: "10", step: "1", value: "" }));
    expect(spec.start).toBe(1);
    expect(holdNumber(99, spec)).toBe(10);
    expect(holdNumber(-5, spec)).toBe(1);
    expect(holdNumber(null, numberSpecOf(props({})))).toBe(0);
  });

  it("steps without binary noise", () => {
    const spec = numberSpecOf(props({ step: "0.1" }));
    expect(stepNumber(0.1, spec, 2)).toBe(0.3);
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(3)).toBe(0);
  });

  it("falls back from a step that is not above zero and drops crossed limits", () => {
    expect(numberSpecOf(props({ step: "0" })).step).toBe(1);
    expect(numberSpecOf(props({ min: "5", max: "2" })).max).toBeNull();
  });

  it("types the value as Int unless a decimal is involved", () => {
    expect(numberTypeOf(props({ step: "1", value: "3" }))).toBe("int");
    expect(numberTypeOf(props({ step: "0.5" }))).toBe("float");
  });
});

describe("counter field", () => {
  const blank = buildDynamicContext({
    page: { name: "P", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });
  const page = (child: ElementNode) =>
    el("r", "page", {}, [el("f", "form", { name: "f" }, [child])]);

  it("is a form field with a typed, held start value", () => {
    const root = page(el("c", "counter", { name: "qty", value: "9", max: "5", step: "1" }));
    const dynamic = withFormDefaults(blank, root);
    expect(dynamic.forms.f?.qty).toBe("5");
    expect(dynamic.types["form.f.qty"]?.type).toBe("int");
  });

  it("reports settings that cannot work", () => {
    expect(formProblems(page(el("c", "counter", { name: "q", step: "0" })))[0]).toContain("step");
    expect(formProblems(page(el("c", "counter", { name: "q", min: "5", max: "1" })))[0]).toContain(
      "maximum"
    );
    expect(formProblems(page(el("c", "counter", { name: "q", min: "a" })))[0]).toContain("number");
    expect(formProblems(page(el("c", "counter", { name: "q", min: "0", max: "9" })))).toEqual([]);
  });

  it("has parts whose buttons react to their own hover and focus", () => {
    const ids = designPartsFor("counter").map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["counter", "dec", "inc", "count", "help"]));
    const dec = COUNTER_PARTS.find((p) => p.id === "dec")!;
    const hover = inputPartSelectors("#a", dec, "hover").join(" ");
    expect(hover).toContain(":where(:hover)");
    expect(hover).toContain('[data-nxt-step="-1"]');
    expect(inputPartSelectors("#a", dec, "disabled").join(" ")).toContain(":where(:disabled)");
    for (const part of COUNTER_PARTS)
      for (const state of part.states)
        for (const group of part.groups)
          for (const item of group.props)
            expect(parseFormDesignKey(inputDesignKey(part.id, item.prop, state))?.part.id).toBe(
              part.id
            );
    expect(editStatesFor("counter")).toEqual(expect.arrayContaining(["error", "success"]));
  });
});
