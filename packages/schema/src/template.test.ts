import { describe, expect, it } from "vitest";
import {
  blankRuleContext,
  evaluateRules,
  needsBrowser,
  ruleSetSchema,
  type Rule,
  type RuleGroup
} from "./rules";
import { addTerm, searchTerms } from "./taxonomy";
import {
  explainLayout,
  resolveLayout,
  resolveNotFound,
  templateSettingsSchema,
  type LayoutCandidate
} from "./template";

const rule = (field: string, op: string, value: string, key = ""): Rule =>
  ({ id: `${field}-${op}`, field, op, value, key }) as Rule;
const group = (match: "all" | "any", ...items: (Rule | RuleGroup)[]): RuleGroup => ({
  id: "g",
  match,
  items
});

describe("taxonomy", () => {
  it("adds a unique term, reuses a name, and searches by substring", () => {
    const a = addTerm([], "Marketing Pages", "1");
    expect(a.term?.slug).toBe("marketing-pages");
    const dup = addTerm(a.terms, "marketing pages", "2");
    expect(dup.terms).toHaveLength(1);
    expect(dup.term?.id).toBe("1");
    const b = addTerm(a.terms, "Marketing-Pages!", "3");
    expect(b.term?.slug).toBe("marketing-pages-2");
    expect(addTerm(a.terms, "  ", "4").term).toBeNull();
    expect(searchTerms(b.terms, "PAGE").map((t) => t.id)).toEqual(["1", "3"]);
    expect(searchTerms(b.terms, "zzz")).toEqual([]);
    expect(searchTerms(b.terms, "")).toHaveLength(2);
  });
});

describe("rules", () => {
  const ctx = blankRuleContext({
    page: {
      name: "Pricing",
      id: "p1",
      createdBy: "Ana",
      publishedAt: "2026-03-01",
      route: "/pricing",
      params: { id: "42" },
      state: {}
    },
    browser: { name: "Firefox", version: "128", language: "en-US", isMobile: false },
    nowIso: "2026-11-07T14:30:00Z",
    resolveTag: (t) => (t === "param.id" ? "42" : "")
  });

  it("compares text, numbers, dates and lists", () => {
    const ok = (r: Rule) => evaluateRules(group("all", r), ctx);
    expect(ok(rule("page.route", "startsWith", "/pri"))).toBe(true);
    expect(ok(rule("page.name", "equals", "pricing"))).toBe(true);
    expect(ok(rule("page.name", "notContains", "blog"))).toBe(true);
    expect(ok(rule("page.createdBy", "isIn", "Bo, Ana"))).toBe(true);
    expect(ok(rule("page.param", "equals", "42", "id"))).toBe(true);
    expect(ok(rule("browser.version", "greaterThan", "100"))).toBe(true);
    expect(ok(rule("browser.version", "lessThan", "100"))).toBe(false);
    expect(ok(rule("page.publishedAt", "before", "2026-06-01"))).toBe(true);
    expect(ok(rule("page.publishedAt", "after", "2026-06-01"))).toBe(false);
    expect(ok(rule("now.year", "equals", "2026"))).toBe(true);
    expect(ok(rule("now.dayOfWeek", "equals", "6"))).toBe(true);
    expect(ok(rule("now.isWeekend", "isTrue", ""))).toBe(true);
    expect(ok(rule("user.loggedIn", "isFalse", ""))).toBe(true);
    expect(ok(rule("is.page", "isTrue", ""))).toBe(true);
    expect(ok(rule("is.template", "isTrue", ""))).toBe(false);
  });

  it("compares a dynamic tag against a value that can hold tags too", () => {
    const ok = (r: Rule) => evaluateRules(group("all", r), ctx);
    expect(ok(rule("dynamic", "equals", "42", "{{param.id}}"))).toBe(true);
    expect(
      ok({
        ...rule("dynamic", "equals", "", "{{param.id}}"),
        value: { kind: "mixed", parts: [{ token: "param.id" }] }
      })
    ).toBe(true);
    expect(ok(rule("dynamic", "equals", "7", "{{param.id}}"))).toBe(false);
  });

  it("joins with all and any, nests, and treats an empty set as everywhere", () => {
    const yes = rule("page.route", "equals", "/pricing");
    const no = rule("page.route", "equals", "/blog");
    expect(evaluateRules(group("all"), ctx)).toBe(true);
    expect(evaluateRules(group("all", yes, no), ctx)).toBe(false);
    expect(evaluateRules(group("any", yes, no), ctx)).toBe(true);
    expect(evaluateRules(group("all", yes, group("any", no, yes)), ctx)).toBe(true);
    expect(evaluateRules(group("all", yes, group("any", no, no)), ctx)).toBe(false);
  });

  it("never matches browser-only fields on the server and flags them", () => {
    const r = rule("page.elementByClass", "isNotEmpty", "", "card");
    expect(evaluateRules(group("all", r), ctx)).toBe(false);
    expect(needsBrowser(group("all", group("any", r)))).toBe(true);
    expect(needsBrowser(group("all", rule("page.route", "equals", "/")))).toBe(false);
  });

  it("rejects groups that nest too deep", () => {
    let deep = group("all");
    for (let i = 0; i < 5; i++) deep = group("all", deep);
    expect(ruleSetSchema.safeParse(deep).success).toBe(false);
    expect(ruleSetSchema.safeParse(group("all", group("any"))).success).toBe(true);
  });
});

describe("layout resolution", () => {
  const settings = (over: Partial<LayoutCandidate["settings"]> = {}) =>
    templateSettingsSchema.parse({ status: "published", ...over });
  const t = (
    id: string,
    type: LayoutCandidate["type"],
    over: Partial<LayoutCandidate["settings"]> = {},
    name = id
  ): LayoutCandidate => ({ id, type, name, settings: settings(over) });
  const ctx = blankRuleContext({
    page: {
      name: "Blog",
      id: "p",
      createdBy: "",
      publishedAt: "",
      route: "/blog/post",
      params: {},
      state: {}
    }
  });
  const auto = { header: "auto", footer: "auto" };

  it("picks by priority, then narrower rules, then name", () => {
    const blog = group("all", rule("page.route", "startsWith", "/blog"));
    const list = [
      t("h-all", "header"),
      t("h-blog", "header", { rules: blog }),
      t("h-top", "header", { priority: 5 }),
      t("f-b", "footer", {}, "B"),
      t("f-a", "footer", {}, "A")
    ];
    expect(resolveLayout(list, auto, ctx).header?.id).toBe("h-top");
    expect(
      resolveLayout(
        list.filter((x) => x.id !== "h-top"),
        auto,
        ctx
      ).header?.id
    ).toBe("h-blog");
    expect(resolveLayout(list, auto, ctx).footer?.id).toBe("f-a");
  });

  it("skips drafts and non-matching templates", () => {
    const list = [
      t("draft", "header", { status: "draft" }),
      t("shop", "header", { rules: group("all", rule("page.route", "equals", "/shop")) })
    ];
    const out = resolveLayout(list, auto, ctx);
    expect(out.header).toBeNull();
    expect(out.decisions[0]?.reason).toBe("none-matched");
  });

  it("honours a page's own choice: none, or one template", () => {
    const list = [t("h1", "header"), t("h2", "header", { priority: 9 })];
    expect(resolveLayout(list, { header: "none", footer: "auto" }, ctx).header).toBeNull();
    expect(resolveLayout(list, { header: "h1", footer: "auto" }, ctx).header?.id).toBe("h1");
    // A chosen template that is a draft or missing falls back to the automatic choice.
    expect(resolveLayout(list, { header: "gone", footer: "auto" }, ctx).header?.id).toBe("h2");
  });

  it("explains each decision", () => {
    const list = [t("h1", "header", {}, "Main header")];
    const lines = explainLayout(resolveLayout(list, auto, ctx).decisions);
    expect(lines[0]).toContain("Main header");
    expect(lines[1]).toContain("no published footer");
  });

  it("finds the 404 template, or none so a default is generated", () => {
    expect(resolveNotFound([t("h", "header")], ctx)).toBeNull();
    expect(resolveNotFound([t("n", "error-404", { status: "draft" })], ctx)).toBeNull();
    expect(resolveNotFound([t("n", "error-404")], ctx)?.id).toBe("n");
  });
});
