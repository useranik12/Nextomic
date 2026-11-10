import { describe, expect, it } from "vitest";
import { buildDynamicContext, withTemplateParams } from "./dynamic-context";
import { defaultPageSettings } from "./page";
import { pageParamSchema, paramProblems } from "./params";

describe("parameters", () => {
  it("needs a default value when required", () => {
    expect(pageParamSchema.safeParse({ name: "id", required: true }).success).toBe(false);
    expect(
      pageParamSchema.safeParse({ name: "id", required: true, defaultValue: "1" }).success
    ).toBe(true);
    expect(
      paramProblems([{ name: "id", type: "string", required: true, defaultValue: " " }])
    ).toEqual({
      id: "A required parameter needs a default value."
    });
  });

  it("gives a template its own parameters, or adds them next to the page's", () => {
    const page = buildDynamicContext({
      page: {
        name: "Home",
        route: "/",
        settings: {
          ...defaultPageSettings(),
          params: [{ name: "id", type: "string", required: false, defaultValue: "p" }]
        }
      },
      mode: "live"
    });
    const defs = [
      { name: "title", type: "string" as const, required: true, defaultValue: "Hi" },
      { name: "id", type: "int" as const, required: false, defaultValue: "1" }
    ];
    const toast = withTemplateParams(page, defs, { title: "Saved" });
    expect(toast.params).toEqual({ title: "Saved", id: "1" });
    expect(toast.types["param.id"]?.type).toBe("int");
    const header = withTemplateParams(page, defs, {}, true);
    expect(header.params).toEqual({ title: "Hi", id: "p" });
    expect(header.types["param.id"]?.type).toBe("string");
  });
});
