import { describe, expect, it } from "vitest";
import { composeForEditor, composePage, STICKY_ATTRIBUTE } from "./compose";
import { elementAnimationCss } from "./css-animation-page";
import { emptyPageTree, pageSettingsSchema } from "./page";
import { blankRuleContext, evaluateRules, type Rule, type RuleGroup } from "./rules";
import { isLive } from "./status";
import { resolveLayout, stickyHeaderSchema, templateSettingsSchema } from "./template";

const rule = (over: Partial<Rule>): Rule =>
  ({
    id: "r",
    field: "page.route",
    key: "",
    op: "equals",
    value: "",
    exclude: false,
    ...over
  }) as Rule;
const group = (items: (Rule | RuleGroup)[], over: Partial<RuleGroup> = {}): RuleGroup => ({
  id: "g",
  match: "all",
  items,
  ...over
});
const ctx = blankRuleContext({
  page: {
    name: "A",
    id: "1",
    createdBy: "",
    publishedAt: "",
    route: "/blog",
    params: {},
    state: {}
  },
  nowIso: "2026-11-07T10:00:00Z"
});

describe("rule exclusion and whole site", () => {
  it("whole site always matches, and excluding it matches nowhere", () => {
    const whole = rule({ field: "site.whole", op: "isTrue" });
    expect(evaluateRules(group([whole]), ctx)).toBe(true);
    expect(evaluateRules(group([{ ...whole, exclude: true }]), ctx)).toBe(false);
  });

  it("excludes a rule and a nested group", () => {
    const blog = rule({ value: "/blog" });
    const whole = rule({ field: "site.whole", op: "isTrue" });
    expect(evaluateRules(group([whole, { ...blog, exclude: true }]), ctx)).toBe(false);
    expect(evaluateRules(group([whole, { ...blog, value: "/about", exclude: true }]), ctx)).toBe(
      true
    );
    const inner = group([blog], { exclude: true });
    expect(evaluateRules(group([whole, inner]), ctx)).toBe(false);
  });

  it("does not let an unknown fact count as excluded", () => {
    const state = rule({
      field: "page.state",
      key: "open",
      op: "equals",
      value: "x",
      exclude: true
    });
    expect(evaluateRules(group([state]), ctx)).toBe(false);
  });
});

describe("status and scheduling", () => {
  it("is live when published, or scheduled with a time that passed", () => {
    const now = Date.parse("2026-11-07T10:00:00Z");
    expect(isLive({ status: "published", scheduledAt: null }, now)).toBe(true);
    expect(isLive({ status: "draft", scheduledAt: null }, now)).toBe(false);
    expect(isLive({ status: "scheduled", scheduledAt: null }, now)).toBe(false);
    expect(isLive({ status: "scheduled", scheduledAt: "2026-11-07T11:00:00Z" }, now)).toBe(false);
    expect(isLive({ status: "scheduled", scheduledAt: "2026-11-07T09:00:00Z" }, now)).toBe(true);
  });

  it("reads an old includeInPublish flag as a status", () => {
    expect(pageSettingsSchema.parse({ includeInPublish: false }).status).toBe("draft");
    expect(pageSettingsSchema.parse({ includeInPublish: true }).status).toBe("published");
    expect(pageSettingsSchema.parse({}).status).toBe("published");
    expect(pageSettingsSchema.parse({ status: "scheduled" }).status).toBe("scheduled");
  });

  it("applies a scheduled template only after its time", () => {
    const tpl = (at: string) => ({
      id: "h",
      type: "header" as const,
      name: "h",
      settings: templateSettingsSchema.parse({
        status: "scheduled",
        scheduledAt: at,
        rules: group([rule({ field: "site.whole", op: "isTrue" })])
      })
    });
    const choices = { header: "auto", footer: "auto" };
    const early = resolveLayout([tpl("2026-11-07T11:00:00Z")], choices, ctx);
    expect(early.header).toBeNull();
    const late = resolveLayout([tpl("2026-11-07T09:00:00Z")], choices, ctx);
    expect(late.header?.id).toBe("h");
  });
});

describe("sticky header and editor layout", () => {
  const leaf = (id: string) => ({ ...emptyPageTree(), id, type: "text", children: [] });
  const page = { ...emptyPageTree(), children: [leaf("p")] };
  const header = { ...emptyPageTree(), children: [leaf("h")] };

  it("validates lengths and keeps defaults", () => {
    expect(stickyHeaderSchema.parse({}).slideAfter).toBe("200px");
    expect(stickyHeaderSchema.safeParse({ stickyAfter: "abc" }).success).toBe(false);
    expect(stickyHeaderSchema.safeParse({ stickyAfter: "5rem", slideAfter: "" }).success).toBe(
      true
    );
  });

  it("puts the sticky settings on the header wrapper and its keyframes in the css", () => {
    const sticky = stickyHeaderSchema.parse({ enabled: true, onScroll: true });
    const out = composePage(page, header, null, sticky);
    const wrap = out.children.find((c) => c.id === "layout-header");
    expect(JSON.parse(String(wrap?.attributes?.[STICKY_ATTRIBUTE]))).toMatchObject({
      animation: "slide-out-up",
      onScroll: true
    });
    expect(wrap?.children[0]?.id).toBe("layout-header-inner");
    expect(elementAnimationCss(out)).toContain("@keyframes nxt-anim-slide-out-up");
    expect(
      composePage(page, header, null, { ...sticky, enabled: false }).children[1]?.attributes
    ).toBeUndefined();
  });

  it("shows header and footer around page elements without wrapping them", () => {
    const out = composeForEditor(page, header, header);
    expect(out.children.map((c) => c.id)).toEqual(["layout-header", "p", "layout-footer"]);
  });
});
