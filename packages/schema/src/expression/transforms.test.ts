import { describe, expect, it } from "vitest";
import { runExpression } from "./evaluate";
import {
  chainKinds,
  compileTransformChain,
  newTransformStep,
  parseTransformChain,
  TRANSFORMS,
  transformsFor,
  type TransformChain,
  type TransformKind,
  type TransformStep
} from "./transforms";

const scope = {
  app: {
    price: 1234.567,
    name: "  new york  ",
    tags: ["a", "b", "c"],
    count: "42.9",
    flag: "yes",
    created: "2026-11-09T09:30:00Z",
    empty: "",
    bad: "not a date",
    obj: { a: 1 }
  }
};

const step = (id: string, values: TransformStep["values"] = {}): TransformStep => ({
  id,
  values: { ...newTransformStep(id).values, ...values }
});
const chain = (base: string, steps: TransformStep[], fallback = ""): TransformChain => ({
  base,
  steps,
  fallback
});
const run = (c: TransformChain, start: TransformKind) =>
  runExpression(compileTransformChain(c, start), scope);

describe("transforms", () => {
  it("compiles to existing methods with ?. and runs", () => {
    const c = chain("app.price", [step("round", { decimals: 2 })]);
    expect(compileTransformChain(c, "number")).toBe("app.price?.round(2)");
    expect(run(c, "number")).toBe(1234.57);
    expect(run(chain("app.name", [step("trim"), step("capitalize")]), "string")).toBe("New York");
    expect(run(chain("app.tags", [step("join", { separator: " | " })]), "array")).toBe("a | b | c");
    expect(run(chain("app.tags", [step("length")]), "array")).toBe(3);
    expect(run(chain("app.tags", [step("last"), step("upper")]), "array")).toBe("C");
    expect(run(chain("app.count", [step("toInteger")]), "string")).toBe(42);
    expect(run(chain("app.flag", [step("toBoolean")]), "string")).toBe(true);
    expect(run(chain("app.obj", [step("toText")]), "object")).toBe('{"a":1}');
    expect(run(chain("app.name", [step("truncate", { length: 5 })]), "string")).toBe("  new…");
    expect(
      run(chain("app.name", [step("replace", { search: " ", with: "_", all: true })]), "string")
    ).toBe("__new_york__");
  });

  it("formats numbers", () => {
    const money = chain("app.price", [
      step("numberFormat", { style: "currency", currency: "eur", decimals: "2", locale: "de-DE" })
    ]);
    expect(compileTransformChain(money, "number")).toBe(
      'app.price?.format("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })'
    );
    expect(run(money, "number")).toMatch(/1\.234,57\s€/);
    expect(run(chain("app.price", [step("numberFormat")]), "number")).toBe("1,234.567");
  });

  it("formats dates from text, with zone, locale and presets", () => {
    const at = (values: TransformStep["values"]) =>
      run(chain("app.created", [step("dateFormat", values)]), "string");
    expect(at({ preset: "date" })).toBe("Nov 9, 2026");
    expect(at({ preset: "iso", zone: "UTC" })).toBe("2026-11-09T09:30:00.000Z");
    expect(at({ preset: "custom", pattern: "dd LLL yyyy HH:mm", zone: "Asia/Kolkata" })).toBe(
      "09 Nov 2026 15:00"
    );
    expect(at({ preset: "custom", pattern: "LLLL", locale: "fr-FR" })).toBe("novembre");
    expect(at({ preset: "time", zone: "UTC" })).toMatch(/^9:30\sAM$/);
    expect(() => at({ preset: "date", zone: "Mars/Base" })).toThrow(/Unknown time zone/);
  });

  it("uses the fallback for empty values and dates that cannot be read", () => {
    const date = chain("app.bad", [step("dateFormat")], "No date");
    expect(compileTransformChain(date, "string")).toBe(
      '$ifEmpty(app.bad?.toDateTime()?.toDateString("en-US"), "No date")'
    );
    expect(run(date, "string")).toBe("No date");
    expect(run(chain("app.empty", [step("upper")], "Guest"), "string")).toBe("Guest");
    expect(run(chain("app.missing", [step("round")], "-"), "any")).toBe("-");
  });

  it("offers steps by kind and follows the kind through the chain", () => {
    const ids = (kind: TransformKind) => transformsFor(kind).map((t) => t.id);
    expect(ids("number")).toContain("numberFormat");
    expect(ids("number")).not.toContain("upper");
    expect(ids("string")).toContain("dateFormat");
    expect(ids("date")).toEqual(["dateFormat"]);
    expect(ids("any")).toHaveLength(TRANSFORMS.length);
    expect(chainKinds("string", [step("toNumber"), step("round"), step("numberFormat")])).toEqual([
      "string",
      "number",
      "number",
      "string"
    ]);
  });

  it("reads every compiled chain back to the same steps", () => {
    const cases: [TransformChain, TransformKind][] = [
      [chain("%posts.item.title", []), "string"],
      [chain("app.price", [step("round", { decimals: 1 }), step("numberFormat")], "n/a"), "number"],
      [chain("app.created", [step("dateFormat", { preset: "relative", locale: "de" })]), "string"],
      [
        chain("app.created", [
          step("toDate", { format: "yyyy-MM-dd" }),
          step("dateFormat", { preset: "custom", pattern: "yyyy", zone: "UTC" })
        ]),
        "string"
      ],
      [chain('param["my-id"]', [step("trim"), step("capitalize", { mode: "first" })]), "string"],
      [chain("app.tags", [step("length"), step("toText")]), "array"],
      [chain("app.name", [step("replace", { search: '"a\\b', with: "x", all: false })]), "string"]
    ];
    for (const [c, kind] of cases) {
      const compiled = compileTransformChain(c, kind);
      const back = parseTransformChain(compiled);
      expect(back, compiled).not.toBeNull();
      expect(compileTransformChain(back as TransformChain, kind)).toBe(compiled);
      expect(back?.steps.map((s) => s.id)).toEqual(c.steps.map((s) => s.id));
      expect(back?.fallback).toBe(c.fallback);
    }
  });

  it("folds To date without a format into Format date", () => {
    const c = chain("app.created", [step("toDate"), step("dateFormat")]);
    expect(parseTransformChain(compileTransformChain(c, "string"))?.steps.map((s) => s.id)).toEqual(
      ["dateFormat"]
    );
  });

  it("does not read hand-written code as a chain", () => {
    expect(parseTransformChain("app.cart.map(i => i.sku)")).toBeNull();
    expect(parseTransformChain("a + b")).toBeNull();
    expect(parseTransformChain("app.x?.round(app.y)")).toBeNull();
    expect(parseTransformChain("app.x.toFixed(2)")).toBeNull();
    expect(parseTransformChain("{{ broken")).toBeNull();
    expect(parseTransformChain("app.price.round(2)")?.steps).toEqual([
      { id: "round", values: { decimals: 2 } }
    ]);
  });
});
