import { describe, expect, it } from "vitest";
import {
  conditionHolds,
  conditionSchema,
  elementConditionHolds,
  elementNodeSchema,
  splitListText,
  type Condition,
  type ElementFacts,
  groupHolds,
  isVisible,
  operandValue,
  patternProblem,
  visibilitySchema,
  type ConditionGroup
} from "./index";

const scope = {
  app: { cart: [{ sku: 1 }, { sku: 2 }], count: 3, name: "Ada", tags: ["a", "b"], on: true },
  user: { role: "admin", loggedIn: false }
};

describe("conditions", () => {
  it("keeps the type of a lone tag and turns mixed text into text", () => {
    expect(operandValue("{{ app.cart.length }}", scope)).toBe(2);
    expect(operandValue("{{ app.tags }}", scope)).toEqual(["a", "b"]);
    expect(operandValue("Hi {{ app.name }}", scope)).toBe("Hi Ada");
    expect(operandValue("{{ app.nope.deep() }}", scope)).toBeUndefined();
    expect(operandValue("plain", scope)).toBe("plain");
  });

  it("applies every operator", () => {
    expect(conditionHolds("equals", "Admin", "admin")).toBe(true);
    expect(conditionHolds("equals", 3, "3")).toBe(true);
    expect(conditionHolds("notEquals", "a", "b")).toBe(true);
    expect(conditionHolds("greaterThan", 3, "2.5")).toBe(true);
    expect(conditionHolds("lessThan", "2026-01-01", "2026-06-01")).toBe(true);
    expect(conditionHolds("greaterThan", "abc", "1")).toBe(false);
    expect(conditionHolds("contains", "Hello world", "WORLD")).toBe(true);
    expect(conditionHolds("contains", ["a", "b"], "b")).toBe(true);
    expect(conditionHolds("notContains", ["a", "b"], "c")).toBe(true);
    expect(conditionHolds("startsWith", "Nextomic", "next")).toBe(true);
    expect(conditionHolds("endsWith", "file.png", ".PNG")).toBe(true);
    expect(conditionHolds("isEmpty", "  ", undefined)).toBe(true);
    expect(conditionHolds("isEmpty", [], undefined)).toBe(true);
    expect(conditionHolds("isNotEmpty", { a: 1 }, undefined)).toBe(true);
    expect(conditionHolds("isTrue", "yes", undefined)).toBe(true);
    expect(conditionHolds("isFalse", 0, undefined)).toBe(true);
    expect(conditionHolds("isIn", "b", "a, b, c")).toBe(true);
    expect(conditionHolds("isIn", 2, "[1,2]")).toBe(true);
    expect(conditionHolds("isNotIn", "z", ["a"])).toBe(true);
    expect(conditionHolds("matches", "AB-123", "^[A-Z]{2}-[0-9]+$")).toBe(true);
  });

  it("refuses slow or invalid patterns", () => {
    expect(patternProblem("(a+)+$")).toMatch(/Repeats inside repeats/);
    expect(patternProblem("[")).toMatch(/not a valid/);
    expect(patternProblem("x".repeat(201))).toMatch(/at most 200/);
    expect(conditionHolds("matches", "aaaa", "(a+)+$")).toBe(false);
  });

  it("joins nested groups with all and any", () => {
    const group: ConditionGroup = {
      id: "g",
      match: "all",
      items: [
        { id: "a", kind: "value", left: "{{ app.count }}", op: "greaterThan", right: "1" },
        {
          id: "h",
          match: "any",
          items: [
            { id: "b", kind: "value", left: "{{ user.loggedIn }}", op: "isTrue", right: "" },
            { id: "c", kind: "value", left: "{{ user.role }}", op: "equals", right: "admin" }
          ]
        }
      ]
    };
    const read = (t: string) => operandValue(t, scope);
    expect(groupHolds(group, read)).toBe(true);
    expect(groupHolds({ ...group, match: "any", items: [] }, read)).toBe(true);
    expect(
      isVisible({ enabled: true, group }, { ...scope, user: { role: "x", loggedIn: false } })
    ).toBe(false);
    expect(isVisible({ enabled: false, group }, {})).toBe(true);
  });

  it("validates limits and drops the old unused shape on read", () => {
    const deep = (n: number): ConditionGroup =>
      n === 0
        ? { id: "x", match: "all", items: [] }
        : { id: `g${n}`, match: "all", items: [deep(n - 1)] };
    expect(visibilitySchema.safeParse({ group: deep(3) }).success).toBe(true);
    expect(visibilitySchema.safeParse({ group: deep(5) }).success).toBe(false);
    const node = elementNodeSchema.parse({
      id: "n",
      type: "text",
      visibility: { match: "all", items: [{ left: "a", op: "equals" }] }
    });
    expect(node.visibility).toBeUndefined();
  });

  it("checks an element's class, ID and attribute", () => {
    const self: ElementFacts = {
      classes: ["card", "is-active"],
      id: "nxtomc-ab12cd34",
      attributes: { "aria-expanded": "true", hidden: "true" }
    };
    const facts = (target: string | undefined) => (target === undefined ? self : undefined);
    const read = (t: string) => operandValue(t, scope);
    const check = (c: Partial<Condition>) =>
      elementConditionHolds(
        { id: "x", kind: "class", left: "", op: "has", right: "", ...c },
        read,
        facts
      );
    expect(check({ left: "is-active" })).toBe(true);
    expect(check({ left: "IS-ACTIVE" })).toBe(false);
    expect(check({ left: "open", op: "notHas" })).toBe(true);
    expect(check({ kind: "id", left: "nxtomc-ab12cd34" })).toBe(true);
    expect(check({ kind: "attribute", left: "Aria-Expanded" })).toBe(true);
    expect(check({ kind: "attribute", left: "aria-expanded", right: "TRUE" })).toBe(true);
    expect(check({ kind: "attribute", left: "aria-expanded", right: "false" })).toBe(false);
    expect(check({ left: "" })).toBe(false);
    // A missing element has nothing.
    expect(check({ target: "gone", left: "card" })).toBe(false);
    expect(check({ target: "gone", left: "card", op: "notHas" })).toBe(true);
    expect(
      groupHolds(
        {
          id: "g",
          match: "all",
          items: [{ id: "c", kind: "class", left: "card", op: "has", right: "" }]
        },
        read,
        facts
      )
    ).toBe(true);
  });

  it("refuses an operator that does not fit the condition type", () => {
    expect(conditionSchema.safeParse({ id: "a", kind: "class", op: "equals" }).success).toBe(false);
    expect(conditionSchema.safeParse({ id: "a", op: "has" }).success).toBe(false);
    expect(conditionSchema.parse({ id: "a", left: "x" }).kind).toBe("value");
  });

  it("splits list text on commas outside tags", () => {
    expect(splitListText("a, b ,, c")).toEqual(["a", "b", "c"]);
    expect(splitListText('{{ x.join(",") }}, d')).toEqual(['{{ x.join(",") }}', "d"]);
    expect(splitListText("")).toEqual([]);
  });
});
