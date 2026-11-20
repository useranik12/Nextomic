import { elementQuerySchema, type ParamField } from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { FlowError, resolveParams } from "./engine";

const field: ParamField = {
  key: "override",
  label: "Query settings",
  kind: "queryOverride",
  targetParam: "query"
};

const saved = (bind: Record<string, string>) =>
  JSON.stringify({
    ...elementQuerySchema.parse({ enabled: true, name: "posts", source: "supabase" }),
    bind
  });

describe("Refresh Query bound settings", () => {
  it("fills the bound slots from the scope", () => {
    const out = resolveParams(
      [field],
      { override: saved({ limit: "{{ app.n }}" }) },
      { app: { n: "30" } }
    );
    expect(out.override).toEqual(["30", "", "", ""]);
  });

  it("names a bad filled value instead of refreshing quietly", () => {
    expect(() =>
      resolveParams([field], { override: saved({ limit: "{{ app.n }}" }) }, { app: { n: "lots" } })
    ).toThrow(FlowError);
    expect(() =>
      resolveParams([field], { override: saved({ limit: "{{ app.n }}" }) }, { app: { n: "lots" } })
    ).toThrow(/Rows must be a whole number/);
  });

  it("sends no extra slots for an action without bound settings", () => {
    expect(resolveParams([field], { override: saved({}) }, {}).override).toEqual([]);
  });
});
