import { describe, expect, it } from "vitest";
import {
  appStateListSchema,
  checkStateValue,
  constantListSchema,
  newAppStateVariable,
  newConstant,
  stateNameProblem,
  valueAfterTypeChange
} from "./state";
import { countStateUsage, emptyStateUsage, renameStateTag } from "./state-usage";
import { buildDynamicContext, createTokenResolver } from "./dynamic-context";
import { projectSettingsSchema } from "./project-settings";

describe("state variable names", () => {
  it("accepts identifiers and refuses reserved words, bad characters and duplicates", () => {
    expect(stateNameProblem("cart_count")).toBeNull();
    expect(stateNameProblem("1st")).not.toBeNull();
    expect(stateNameProblem("my-var")).not.toBeNull();
    expect(stateNameProblem("user")).toMatch(/reserved/);
    expect(stateNameProblem("Constructor")).toMatch(/reserved/);
    expect(stateNameProblem("a", ["a"])).toMatch(/already/);
  });

  it("refuses duplicate names in a list", () => {
    const a = newAppStateVariable("1", []);
    expect(appStateListSchema.safeParse([a, { ...a, id: "2" }]).success).toBe(false);
  });
});

describe("typed values", () => {
  it.each([
    ["integer", "42", true],
    ["integer", "4.2", false],
    ["float", "4.2", true],
    ["boolean", "true", true],
    ["boolean", "yes", false],
    ["date", "2026-01-31", true],
    ["date", "31/01/2026", false],
    ["time", "09:30", true],
    ["datetime", "2026-01-31T09:30", true],
    ["color", "#1a73e8", true],
    ["color", "blue-ish", false],
    ["url", "https://example.com/a.png", true],
    ["url", "javascript:alert(1)", false],
    ["json", '{"a":1}', true],
    ["json", "{a:1}", false]
  ] as const)("%s %s fits: %s", (type, text, ok) => {
    expect(checkStateValue(type, false, text) === null).toBe(ok);
  });

  it("checks enum values against the options", () => {
    expect(checkStateValue("enum", false, "m", ["s", "m"])).toBeNull();
    expect(checkStateValue("enum", false, "xl", ["s", "m"])).not.toBeNull();
  });

  it("reads lists as JSON arrays of the type", () => {
    expect(checkStateValue("integer", true, "[1, 2]")).toBeNull();
    expect(checkStateValue("integer", true, '[1, "a"]')).toMatch(/Item 2/);
    expect(checkStateValue("string", true, "a, b")).not.toBeNull();
  });

  it("treats empty text as no value", () => {
    expect(checkStateValue("integer", false, "")).toBeNull();
  });

  it("refuses a saved value that does not fit", () => {
    const c = { ...newConstant("1", []), type: "integer" as const, value: "abc" };
    expect(constantListSchema.safeParse([c]).success).toBe(false);
  });

  it("keeps a value across a type change only when it still fits", () => {
    expect(valueAfterTypeChange("3", "float", false, [])).toBe("3");
    expect(valueAfterTypeChange("abc", "integer", false, [])).toBe("");
  });

  it("projects without state read as empty lists", () => {
    const parsed = projectSettingsSchema.parse({});
    expect(parsed.appState).toEqual([]);
    expect(parsed.constants).toEqual([]);
  });
});

describe("app and const tags", () => {
  const ctx = buildDynamicContext({
    page: { name: "Home", route: "/", settings: { params: [], state: [] } },
    mode: "preview",
    globals: {
      appState: [{ name: "cart", defaultValue: '{"items":[{"name":"Tea"}]}' }],
      constants: [{ name: "support", value: "help@example.com" }]
    }
  });
  const resolve = createTokenResolver(ctx);

  it("resolve to their values and follow JSON paths", () => {
    expect(resolve("const.support")).toBe("help@example.com");
    expect(resolve("app.cart.items.0.name")).toBe("Tea");
    expect(resolve("app.missing")).toBe("");
  });
});

describe("where state is used", () => {
  const tree = {
    props: {
      text: { kind: "mixed", parts: ["Hi ", { token: "app.name" }, { token: "const.site.url" }] },
      title: "{{ app.name }} and {{app.named}}"
    }
  };

  it("counts tags in text and in token parts", () => {
    expect(countStateUsage(tree, emptyStateUsage())).toEqual({
      app: { name: 2, named: 1 },
      const: { site: 1 }
    });
  });

  it("renames only the exact name and keeps paths", () => {
    const { value, changed } = renameStateTag(tree, "app", "name", "first");
    expect(changed).toBe(true);
    expect(value.props.title).toBe("{{ app.first }} and {{app.named}}");
    expect(value.props.text.parts[1]).toEqual({ token: "app.first" });
    expect(renameStateTag(tree, "const", "nope", "x").changed).toBe(false);
  });
});
