import { describe, expect, it } from "vitest";
import {
  appStateListSchema,
  checkStateValue,
  constantListSchema,
  newAppStateVariable,
  newConstant,
  describeType,
  stateNameProblem,
  stateTypeSchema,
  typeReferences,
  valueAfterTypeChange,
  type TypeRegistry,
  type TypeSpec
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

const spec = (type: TypeSpec["type"], isList = false, ref = ""): TypeSpec => ({
  type,
  isList,
  ref
});

const registry: TypeRegistry = {
  enums: [{ id: "e1", name: "Size", description: "", values: ["s", "m"] }],
  dataTypes: [
    {
      id: "d1",
      name: "Address",
      description: "",
      fields: [
        { id: "f1", name: "city", type: "string", isList: false, ref: "", description: "" },
        { id: "f2", name: "size", type: "enum", isList: false, ref: "e1", description: "" },
        { id: "f3", name: "tags", type: "string", isList: true, ref: "", description: "" }
      ]
    }
  ]
};

describe("typed values", () => {
  it.each([
    ["number", "42", true],
    ["number", "4.2", true],
    ["number", "abc", false],
    ["boolean", "true", true],
    ["boolean", "yes", false],
    ["timestamptz", "2026-01-31T09:30:00Z", true],
    ["timestamptz", "2026-01-31 09:30:00+05:30", true],
    ["timestamptz", "2026-01-31T09:30", true],
    ["timestamptz", "31/01/2026", false],
    ["color", "#1a73e8", true],
    ["color", "blue-ish", false],
    ["url", "https://example.com/a.png", true],
    ["url", "javascript:alert(1)", false],
    ["json", '{"a":1}', true],
    ["json", "{a:1}", false],
    ["supabaseRow", '{"id":1}', true],
    ["supabaseRow", "[1]", false]
  ] as const)("%s %s fits: %s", (type, text, ok) => {
    expect(checkStateValue(spec(type), text) === null).toBe(ok);
  });

  it("reads old type names as their replacements", () => {
    expect(stateTypeSchema.parse("integer")).toBe("number");
    expect(stateTypeSchema.parse("date")).toBe("timestamptz");
  });

  it("checks enum values against the app enum", () => {
    expect(checkStateValue(spec("enum", false, "e1"), "m", registry)).toBeNull();
    expect(checkStateValue(spec("enum", false, "e1"), "xl", registry)).not.toBeNull();
    expect(checkStateValue(spec("enum", false, "missing"), "m", registry)).toMatch(/Choose/);
  });

  it("checks data type values field by field", () => {
    const address = spec("dataType", false, "d1");
    expect(
      checkStateValue(address, '{"city":"Pune","size":"s","tags":["a"]}', registry)
    ).toBeNull();
    expect(checkStateValue(address, '{"city":3}', registry)).toMatch(/city/);
    expect(checkStateValue(address, '{"size":"xl"}', registry)).toMatch(/size/);
    expect(checkStateValue(address, '{"zip":"1"}', registry)).toMatch(/no field "zip"/);
  });

  it("reads lists as JSON arrays of the type", () => {
    expect(checkStateValue(spec("number", true), "[1, 2.5]")).toBeNull();
    expect(checkStateValue(spec("number", true), '[1, "a"]')).toMatch(/Item 2/);
    expect(checkStateValue(spec("string", true), "a, b")).not.toBeNull();
  });

  it("treats empty text as no value", () => {
    expect(checkStateValue(spec("number"), "")).toBeNull();
  });

  it("refuses a saved value that does not fit", () => {
    const c = { ...newConstant("1", []), type: "number" as const, value: "abc" };
    expect(constantListSchema.safeParse([c]).success).toBe(false);
  });

  it("keeps a value across a type change only when it still fits", () => {
    expect(valueAfterTypeChange("3", spec("string"))).toBe("3");
    expect(valueAfterTypeChange("abc", spec("number"))).toBe("");
  });

  it("finds where an enum or data type is referenced", () => {
    const uses = typeReferences("e1", {
      appState: [{ ...newAppStateVariable("1", []), type: "enum", ref: "e1" }],
      constants: [],
      dataTypes: registry.dataTypes
    });
    expect(uses).toEqual(["App state variable_1", "Field Address.size"]);
  });

  it("describes types with their reference", () => {
    expect(describeType(spec("enum", true, "e1"), registry)).toBe("Enum Size list");
  });

  it("projects without state read as empty lists", () => {
    const parsed = projectSettingsSchema.parse({});
    expect(parsed.appState).toEqual([]);
    expect(parsed.enums).toEqual([]);
    expect(parsed.dataTypes).toEqual([]);
  });
});

describe("app and const tags", () => {
  const ctx = buildDynamicContext({
    page: { name: "Home", route: "/", settings: { params: [], state: [] } },
    mode: "preview",
    globals: {
      appState: [
        {
          name: "cart",
          type: "json",
          isList: false,
          ref: "",
          defaultValue: '{"items":[{"name":"Tea"}]}'
        },
        { name: "count", type: "number", isList: false, ref: "", defaultValue: "3" },
        {
          name: "since",
          type: "timestamptz",
          isList: false,
          ref: "",
          defaultValue: "2026-01-31T09:30:00Z"
        }
      ],
      constants: [
        { name: "support", type: "string", isList: false, ref: "", value: "help@example.com" }
      ]
    }
  });
  const resolve = createTokenResolver(ctx);

  it("resolve to their values and follow JSON paths", () => {
    expect(resolve("const.support")).toBe("help@example.com");
    expect(resolve("app.cart.items.0.name")).toBe("Tea");
    expect(resolve("app.missing")).toBe("");
  });

  it("are typed in expressions", () => {
    expect(resolve("app.count + 2")).toBe("5");
    expect(resolve('app.since.toFormat("dd LLL yyyy")')).toBe("31 Jan 2026");
    expect(resolve("const.support.toUpperCase()")).toBe("HELP@EXAMPLE.COM");
    expect(resolve('app.cart.items.pluck("name").join()')).toBe("Tea");
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
