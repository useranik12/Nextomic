import { describe, expect, it } from "vitest";
import { buildDynamicContext, createTokenResolver } from "./dynamic-context";
import { elementNodeSchema } from "./element";
import { defaultPageSettings } from "./page";
import { stateRefs } from "./state-deps";
import {
  DEFAULT_MESSAGES,
  activeForms,
  formPlacementProblem,
  formProblems,
  formsOf,
  freeFormName,
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
