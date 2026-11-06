import { blankRuleContext, type RuleContext } from "@nextomic/schema";

/** The facts the editor knows about a page: enough to check which templates apply to it. */
export function pageRuleContext(page: { id: string; name: string; route: string }): RuleContext {
  return blankRuleContext({
    kind: "page",
    page: {
      name: page.name,
      id: page.id,
      createdBy: "",
      publishedAt: "",
      route: page.route,
      params: {},
      state: {}
    },
    url: { full: page.route, host: "", path: page.route, query: "", referrer: "" }
  });
}
