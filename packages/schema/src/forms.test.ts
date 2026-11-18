import { describe, expect, it } from "vitest";
import { buildDynamicContext, createTokenResolver } from "./dynamic-context";
import { elementNodeSchema } from "./element";
import { defaultPageSettings } from "./page";
import { asFieldQuery, fieldQueryProblem, queryLimit } from "./query";
import { stateDependencies, stateRefs } from "./state-deps";
import {
  DEFAULT_MESSAGES,
  activeForms,
  formPlacementProblem,
  formProblems,
  formsOf,
  freeFormName,
  listText,
  optionColumnProblem,
  optionLockProblem,
  outdentProblem,
  optionValueProblem,
  parseList,
  uniquifyFormNames,
  validateValue,
  withFormDefaults,
  type FieldRules
} from "./forms";

const el = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: unknown[] = [],
  extra = {}
) => elementNodeSchema.parse({ id, type, props, children, ...extra });
const form = (id: string, name: string, children: unknown[] = [], props = {}) =>
  el(id, "form", { name, ...props }, children);
const input = (id: string, name: string, props = {}) => el(id, "input", { name, ...props });
const page = (...children: unknown[]) => el("root", "page", {}, children);

const rules = (patch: Partial<FieldRules> = {}): FieldRules => ({
  type: "text",
  required: false,
  minLength: null,
  maxLength: null,
  min: null,
  max: null,
  pattern: "",
  matchValue: null,
  messages: {},
  ...patch
});

describe("forms of a tree", () => {
  it("lists forms with named fields and skips inactive ones as active", () => {
    const root = page(
      form("f1", "signup", [input("a", "email", { type: "email" }), input("b", "")]),
      form("f2", "old", [], { status: "inactive" })
    );
    expect(formsOf(root).map((f) => [f.name, f.active, f.fields.map((x) => x.name)])).toEqual([
      ["signup", true, ["email"]],
      ["old", false, []]
    ]);
    expect(activeForms(root).map((f) => f.name)).toEqual(["signup"]);
  });

  it("reports duplicate, nested, looped and badly named forms", () => {
    const root = page(
      form("f1", "a", [input("x", "n"), input("y", "N")]),
      form("f2", "a"),
      form("f3", "bad name"),
      el("c", "container", {}, [form("f4", "inLoop")], {
        query: { enabled: true, source: "supabase", name: "l" }
      }),
      form("f5", "outer", [form("f6", "inner")])
    );
    const problems = formProblems(root);
    expect(problems).toContain('Form "a" has two fields named "N".');
    expect(problems).toContain('Two forms are named "a".');
    expect(problems.some((p) => /letters, digits/.test(p))).toBe(true);
    expect(problems).toContain('Form "inLoop" cannot sit inside a query loop.');
    expect(problems).toContain("A form cannot sit inside another form.");
  });

  it("finds a free name", () => {
    expect(freeFormName(["form", "Form2"], "form")).toBe("form3");
    expect(freeFormName([], "form")).toBe("form");
  });
});

describe("validateValue for checks and lists", () => {
  it("a required checkbox must be checked", () => {
    const r = rules({ kind: "check", required: true });
    expect(validateValue("false", r)).toBe("This field is required.");
    expect(validateValue("true", r)).toBeNull();
    expect(validateValue("false", rules({ kind: "check" }))).toBeNull();
  });
  it("a list counts its items and keeps commas inside an item", () => {
    const r = rules({ kind: "many", required: true, minSelected: 2, maxSelected: 3 });
    expect(parseList('["a,b","c"]')).toEqual(["a,b", "c"]);
    expect(parseList("not json")).toEqual([]);
    expect(validateValue("[]", r)).toBe("This field is required.");
    expect(validateValue(listText(["a"]), r)).toBe("Choose at least 2.");
    expect(validateValue(listText(["a", "b", "c", "d"]), r)).toBe("Choose at most 3.");
    expect(validateValue(listText(["a", "b"]), r)).toBeNull();
    expect(validateValue("[]", rules({ kind: "many", minSelected: 2 }))).toBeNull();
  });
});

describe("checkbox fields", () => {
  const blank = buildDynamicContext({
    page: { name: "P", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });
  const checkbox = (id: string, name: string, props = {}) => el(id, "checkbox", { name, ...props });
  it("is a form field with its own start value", () => {
    const root = page(
      form("f1", "signup", [checkbox("a", "agree", { checked: true }), checkbox("b", "news")])
    );
    expect(formsOf(root)[0]?.fields.map((f) => f.name)).toEqual(["agree", "news"]);
    const dynamic = withFormDefaults(blank, root);
    expect(dynamic.forms.signup).toEqual({ agree: "true", news: "false" });
  });
  it("keeps the visitor's value over the start value", () => {
    const root = page(form("f1", "signup", [checkbox("a", "agree", { checked: true })]));
    const dynamic = withFormDefaults({ ...blank, forms: { signup: { agree: "false" } } }, root);
    expect(dynamic.forms.signup?.agree).toBe("false");
  });
});

describe("option fields", () => {
  const option = (id: string, props = {}) => el(id, "option", { label: id, ...props });
  const group = (type: string, children: unknown[], props = {}) =>
    el("g", type, { name: "pick", ...props }, children);
  const blank = buildDynamicContext({
    page: { name: "P", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });

  it("starts with the chosen options: one value for radio, a list for several", () => {
    const kids = [option("A", { selected: true }), option("B", { value: "bee", selected: true })];
    const radio = page(form("f", "s", [group("radio", kids)]));
    expect(withFormDefaults(blank, radio).forms.s?.pick).toBe("A");
    const many = page(form("f", "s", [group("checkboxGroup", kids)]));
    expect(withFormDefaults(blank, many).forms.s?.pick).toBe('["A","bee"]');
    expect(withFormDefaults(blank, many).types["form.s.pick"]?.isList).toBe(true);
    const single = page(form("f", "s", [group("choiceChips", kids, { multiple: false })]));
    expect(withFormDefaults(blank, single).forms.s?.pick).toBe("A");
    expect(withFormDefaults(blank, single).types["form.s.pick"]).toBeUndefined();
  });

  it("types the values of a list by the field's value type", () => {
    const kids = [
      option("A", { value: "1", selected: true }),
      option("B", { value: "2", selected: true })
    ];
    const ints = page(form("f", "s", [group("checkboxGroup", kids, { valueType: "int" })]));
    const out = withFormDefaults(blank, ints);
    expect(out.forms.s?.pick).toBe("[1,2]");
    expect(out.types["form.s.pick"]).toEqual({ type: "int", isList: true, ref: "" });
    expect(parseList("[1,2]")).toEqual(["1", "2"]);
    expect(listText(["true", "x"], "boolean")).toBe('[true,"x"]');
    const one = page(form("f", "s", [group("radio", kids, { valueType: "int" })]));
    expect(withFormDefaults(blank, one).types["form.s.pick"]).toEqual({
      type: "int",
      isList: false,
      ref: ""
    });
  });

  it("keeps one template option when the options are dynamic", () => {
    const query = { enabled: true, name: "sizes" };
    const dyn = (kids: unknown[], extra = {}) =>
      page(form("f", "s", [{ ...group("radio", kids, { optionsSource: "dynamic" }), ...extra }]));
    const tree = dyn([option("A")], { query });
    expect(formProblems(tree as never)).toEqual([]);
    expect(optionLockProblem(tree as never, "A")).toMatch(/template/);
    expect(optionLockProblem(tree as never, "g")).toBeNull();
    expect(formProblems(dyn([option("A")]) as never)[0]).toMatch(/no query is set up/);
    expect(formProblems(dyn([option("A"), option("B")], { query }) as never)[0]).toMatch(
      /exactly one option/
    );
    expect(formPlacementProblem(tree as never, "g", option("C") as never)).toMatch(/query/);
    const fixed = page(form("f", "s", [group("radio", [option("A")])]));
    expect(optionLockProblem(fixed as never, "A")).toBeNull();
  });

  it("keeps a field query a plain list and warns when a column does not fit", () => {
    const query = {
      enabled: true,
      name: "sizes",
      supabase: { infiniteScroll: true, realtime: true }
    };
    const tree = page(
      form("f", "s", [
        {
          ...group("radio", [option("A", { value: "{{ %sizes.item.id }}" })], {
            optionsSource: "dynamic",
            valueType: "int"
          }),
          query
        }
      ])
    );
    const field = tree.children[0]?.children[0];
    expect(fieldQueryProblem(field?.query as never)).toMatch(/infinite scroll/);
    expect(formProblems(tree as never).join(" ")).toMatch(/infinite scroll/);
    const plain = asFieldQuery(field?.query as never);
    expect(fieldQueryProblem(plain)).toBeNull();
    expect(plain.supabase.realtime).toBe(false);
    expect(queryLimit(plain)).toBe(20);

    const structure = (type: string) =>
      ({
        schemas: [
          {
            schema: "public",
            functions: [],
            tables: [
              {
                name: "sizes",
                kind: "table",
                description: null,
                operations: ["select"],
                columns: [
                  {
                    name: "id",
                    pgType: "x",
                    type,
                    isList: false,
                    nullable: false,
                    primaryKey: true,
                    references: null,
                    enumValues: null,
                    hasDefault: false,
                    description: null
                  }
                ]
              }
            ]
          }
        ],
        buckets: []
      }) as never;
    const typed = (value: string) => {
      const node = field as never as typeof field;
      return node ? { ...node, children: [option("A", { value })] } : node;
    };
    const withTable = (g: unknown) => ({
      ...(g as object),
      query: {
        ...(field?.query as object),
        supabase: { ...field?.query?.supabase, table: "sizes" }
      }
    });
    const grp = withTable(typed("{{ %sizes.item.id }}"));
    expect(optionColumnProblem(grp as never, structure("string"))).toMatch(/expects int/);
    expect(optionColumnProblem(grp as never, structure("int"))).toBeNull();
    expect(optionColumnProblem(grp as never, null)).toBeNull();
  });

  it("reads a form field in a field's query as a dependency, so the field redraws on change", () => {
    const tree = page(
      form("f", "s", [
        input("country", "country"),
        {
          ...group("radio", [option("A")], { optionsSource: "dynamic" }),
          id: "city",
          query: {
            enabled: true,
            name: "cities",
            source: "supabase",
            supabase: {
              table: "cities",
              filters: [{ id: "x", column: "country", value: "{{ form.s.country }}" }]
            }
          }
        }
      ])
    );
    expect(stateDependencies(tree)["city"]).toContain("form.s.country");
  });

  it("moves a node out only where its new parent accepts it", () => {
    const tree = page(
      form("f", "s", [el("box", "container", {}, [option("A")])]),
      el("g2", "container", {}, [])
    );
    expect(outdentProblem(tree as never, "A")).toMatch(/option goes inside/);
  });

  it("refuses a written option value that does not fit the value type", () => {
    const text = (value: string) =>
      formProblems(
        page(form("f", "s", [group("radio", [option("A", { value })], { valueType: "int" })]))
      );
    expect(text("12")).toEqual([]);
    expect(text("twelve")[0]).toMatch(/not a valid int value: Expected a whole number/);
    // The label is the value when none is written; dynamic values are checked when the page is drawn.
    expect(
      formProblems(page(form("f", "s", [group("radio", [option("Big")], { valueType: "int" })])))
    ).toHaveLength(1);
    const dynamic = { kind: "mixed", parts: [{ token: "page.name" }] };
    expect(text(dynamic as never)).toEqual([]);
    expect(optionValueProblem("string", "anything")).toBeNull();
    expect(optionValueProblem("boolean", "yes")).toMatch(/true or false/);
  });

  it("lists the group as a field of its form", () => {
    const root = page(form("f", "s", [group("radio", [option("A")])]));
    expect(formsOf(root)[0]?.fields).toEqual([{ id: "g", name: "pick", type: "radio" }]);
  });

  it("keeps options inside option fields and nothing else", () => {
    const root = page(form("f", "s", [group("radio", [option("A")])]), el("p", "container"));
    expect(formPlacementProblem(root, "g", option("B"))).toBeNull();
    expect(formPlacementProblem(root, "p", option("B"))).toMatch(/option goes inside/);
    expect(formPlacementProblem(root, "g", el("x", "container"))).toMatch(/can only hold options/);
  });
});

describe("validateValue", () => {
  it("handles required and empty optional", () => {
    expect(validateValue("  ", rules({ required: true }))).toBe("This field is required.");
    expect(validateValue("", rules())).toBeNull();
    expect(validateValue("", rules({ required: true, messages: { required: "Fill me" } }))).toBe(
      "Fill me"
    );
  });
  it("checks type, length, range, pattern and match", () => {
    expect(validateValue("nope", rules({ type: "email" }))).toMatch(/email/);
    expect(validateValue("a@b.co", rules({ type: "email" }))).toBeNull();
    expect(validateValue("ftp://x", rules({ type: "url" }))).toMatch(/web address/);
    expect(validateValue("abc", rules({ type: "number" }))).toBe("Enter a number.");
    expect(validateValue("3", rules({ type: "number", min: 5 }))).toBe("Enter 5 or more.");
    expect(validateValue("ab", rules({ minLength: 3 }))).toBe("Use at least 3 characters.");
    expect(validateValue("abcd", rules({ maxLength: 3 }))).toBe("Use at most 3 characters.");
    expect(validateValue("x1", rules({ pattern: "^[a-z]+$" }))).toMatch(/format/);
    expect(validateValue("a", rules({ matchValue: "b" }))).toBe("The values do not match.");
    expect(validateValue("b", rules({ matchValue: "b" }))).toBeNull();
  });
  it("fills {type}, {length} and {range} in custom and default messages", () => {
    const messages = {
      length: "Needs {length} letters",
      range: "Pick {range}",
      type: "Not {type}"
    };
    expect(validateValue("ab", rules({ minLength: 3, messages }))).toBe("Needs at least 3 letters");
    expect(validateValue("9", rules({ type: "number", max: 5, messages }))).toBe("Pick 5 or less");
    expect(validateValue("x", rules({ type: "url", messages }))).toBe("Not a valid web address");
    expect(validateValue("a", rules({ matchValue: "b", messages: { match: "" } }))).toBe(
      DEFAULT_MESSAGES.match
    );
  });
  it("ignores a dangerous pattern instead of running it", () => {
    expect(validateValue("aaaa!", rules({ pattern: "(a+)+$" }))).toBeNull();
  });
});

describe("form values in dynamic data", () => {
  const dynamic = buildDynamicContext({
    page: { name: "P", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });
  const root = page(
    form("f1", "signup", [
      input("a", "email", { value: "a@b.co" }),
      input("b", "pw", { type: "password", value: "secret" })
    ]),
    form("f2", "off", [input("c", "x")], { status: "inactive" })
  );

  it("fills starting values for active forms only and keeps passwords empty", () => {
    expect(withFormDefaults(dynamic, root).forms).toEqual({ signup: { email: "a@b.co", pw: "" } });
  });

  it("takes the visitor's values but ignores forms and fields the tree lacks", () => {
    const sent = {
      ...dynamic,
      forms: { signup: { email: "me@x.io", pw: "leak", nope: "1" }, ghost: { a: "1" } }
    };
    expect(withFormDefaults(sent, root).forms).toEqual({ signup: { email: "me@x.io", pw: "" } });
  });

  it("resolves {{ form.* }} tags and lists them as dependencies", () => {
    const filled = withFormDefaults(dynamic, root);
    expect(createTokenResolver(filled)("form.signup.email")).toBe("a@b.co");
    expect(stateRefs("Hi {{ form.signup.email.toUpperCase() }}")).toEqual(["form.signup.email"]);
  });
});

describe("placing forms", () => {
  it("refuses a form inside a form or a query loop", () => {
    const root = page(
      form("f1", "a", [el("box", "container")]),
      el("loop", "container", {}, [], { query: { enabled: true, source: "supabase", name: "l" } })
    );
    expect(formPlacementProblem(root, "box", form("n", "b"))).toMatch(/another form/);
    expect(formPlacementProblem(root, "loop", form("n", "b"))).toMatch(/query loop/);
    expect(formPlacementProblem(root, "root", form("n", "b"))).toBeNull();
    expect(formPlacementProblem(root, "box", input("i", "x"))).toBeNull();
  });

  it("names new forms and fields so they stay unique", () => {
    const root = page(form("f1", "form", [input("a", "field")]));
    const fresh = form("f2", "form", [input("b", "field"), input("c", "field")]);
    uniquifyFormNames(root, "root", fresh);
    expect(fresh.props.name).toBe("form2");
    expect(fresh.children.map((c) => c.props.name)).toEqual(["field", "field2"]);
    const loose = input("d", "field");
    uniquifyFormNames(root, "f1", loose);
    expect(loose.props.name).toBe("field2");
  });

  it("ignores its own elements when a duplicate is already in the tree", () => {
    const original = form("f1", "form", [input("a", "field")]);
    const copy = structuredClone(original);
    copy.id = "f2";
    copy.children[0]!.id = "b";
    const root = page(original, copy);
    uniquifyFormNames(root, "root", copy);
    expect(copy.props.name).toBe("form2");
    expect(original.props.name).toBe("form");
  });
});
