import { z } from "zod";
import { elementNodeSchema } from "./element";
import { evaluateRules, ruleSetSchema, ruleSpecificity, type RuleContext } from "./rules";

// Templates (docs/templates-and-themes.md section 4): a header, a footer and a 404 page in v1.
// They are edited on the same canvas as pages and applied to pages by rules.

export const TEMPLATE_TYPES = ["header", "footer", "error-404"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  header: "Header",
  footer: "Footer",
  "error-404": "404 page"
};
export const templateTypeSchema = z.enum(TEMPLATE_TYPES);

/** Whether a page or template shows the header or footer that applies, none, or one specific template. */
export const layoutChoiceSchema = z.string().max(64).default("auto");
export const LAYOUT_AUTO = "auto";
export const LAYOUT_NONE = "none";

export const emptyRules = () => ({ id: "root", match: "all" as const, items: [] });

export const templateSettingsSchema = z.object({
  description: z.string().max(500).default(""),
  /** Where it applies. An empty set means everywhere. Not used by the 404 template. */
  rules: ruleSetSchema.default(emptyRules()),
  /** Higher wins when more than one template of a type matches. */
  priority: z.number().int().min(0).max(1000).default(0),
  /** Forced theme id; null follows the page. */
  themeId: z.string().max(64).nullable().default(null),
  /** Draft templates are never applied. */
  status: z.enum(["draft", "published"]).default("draft"),
  /** A 404 template may hide the header or footer. */
  header: layoutChoiceSchema,
  footer: layoutChoiceSchema,
  categoryIds: z.array(z.string().max(64)).max(50).default([]),
  tagIds: z.array(z.string().max(64)).max(50).default([])
});
export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

export const templateNameSchema = z.string().trim().min(1).max(100);

export const createTemplateInputSchema = z.object({
  name: templateNameSchema,
  type: templateTypeSchema
});
export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;

export const templateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: templateTypeSchema,
  name: templateNameSchema,
  settings: templateSettingsSchema,
  tree: elementNodeSchema,
  version: z.number().int().min(1),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Template = z.infer<typeof templateSchema>;

export const saveTemplateInputSchema = z.object({
  baseVersion: z.number().int().min(1),
  name: templateNameSchema.optional(),
  settings: templateSettingsSchema.optional(),
  tree: elementNodeSchema.optional()
});
export type SaveTemplateInput = z.infer<typeof saveTemplateInputSchema>;

export function defaultTemplateSettings(): TemplateSettings {
  return templateSettingsSchema.parse({});
}

/** What a visitor sees: the template as it was when the project was published. */
export type PublishedTemplate = Pick<Template, "id" | "type" | "name" | "settings" | "tree">;

export interface LayoutCandidate {
  id: string;
  type: TemplateType;
  name: string;
  settings: Pick<TemplateSettings, "priority" | "status" | "rules">;
}

export type LayoutSlot = "header" | "footer";
export type LayoutReason = "chosen" | "rules" | "everywhere" | "none-chosen" | "none-matched";

export interface LayoutDecision {
  slot: LayoutSlot;
  template: LayoutCandidate | null;
  reason: LayoutReason;
}

/** Highest priority, then the narrowest rules, then name, so the result never depends on list order. */
function pickBest<T extends LayoutCandidate>(
  list: readonly T[],
  ctx: RuleContext
): { best: T | null; matchedRules: boolean } {
  const matching = list.filter(
    (t) => t.settings.status === "published" && evaluateRules(t.settings.rules, ctx)
  );
  matching.sort(
    (a, b) =>
      b.settings.priority - a.settings.priority ||
      ruleSpecificity(b.settings.rules) - ruleSpecificity(a.settings.rules) ||
      a.name.localeCompare(b.name)
  );
  const best = matching[0] ?? null;
  return { best, matchedRules: best ? best.settings.rules.items.length > 0 : false };
}

/** The header or footer for a page: its own choice (none, or one template) or the best match. */
export function resolveSlot<T extends LayoutCandidate>(
  slot: LayoutSlot,
  templates: readonly T[],
  choice: string,
  ctx: RuleContext
): { template: T | null; decision: LayoutDecision } {
  const own = templates.filter((t) => t.type === slot);
  if (choice === LAYOUT_NONE)
    return { template: null, decision: { slot, template: null, reason: "none-chosen" } };
  if (choice !== LAYOUT_AUTO) {
    const chosen = own.find((t) => t.id === choice && t.settings.status === "published");
    if (chosen) return { template: chosen, decision: { slot, template: chosen, reason: "chosen" } };
  }
  const { best, matchedRules } = pickBest(own, ctx);
  if (!best) return { template: null, decision: { slot, template: null, reason: "none-matched" } };
  return {
    template: best,
    decision: { slot, template: best, reason: matchedRules ? "rules" : "everywhere" }
  };
}

export interface ResolvedLayout<T extends LayoutCandidate> {
  header: T | null;
  footer: T | null;
  decisions: LayoutDecision[];
}

export function resolveLayout<T extends LayoutCandidate>(
  templates: readonly T[],
  choices: { header: string; footer: string },
  ctx: RuleContext
): ResolvedLayout<T> {
  const header = resolveSlot("header", templates, choices.header, ctx);
  const footer = resolveSlot("footer", templates, choices.footer, ctx);
  return {
    header: header.template,
    footer: footer.template,
    decisions: [header.decision, footer.decision]
  };
}

/** The 404 page: the best published 404 template, or null so a generated default is shown. */
export function resolveNotFound<T extends LayoutCandidate>(
  templates: readonly T[],
  ctx: RuleContext
): T | null {
  return pickBest(
    templates.filter((t) => t.type === "error-404"),
    ctx
  ).best;
}

/** Plain-language lines for "Why is this applied?". */
export function explainLayout(decisions: readonly LayoutDecision[]): string[] {
  return decisions.map(({ slot, template, reason }) => {
    const label = slot === "header" ? "Header" : "Footer";
    switch (reason) {
      case "chosen":
        return `${label}: ${template?.name ?? ""}, chosen in this page's settings.`;
      case "rules":
        return `${label}: ${template?.name ?? ""}, its rules match this page.`;
      case "everywhere":
        return `${label}: ${template?.name ?? ""}, it applies everywhere and nothing narrower matched.`;
      case "none-chosen":
        return `${label}: none, this page turns it off.`;
      default:
        return `${label}: none, no published ${slot} template matches this page.`;
    }
  });
}
