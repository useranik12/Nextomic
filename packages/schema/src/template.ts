import { z } from "zod";
import { pageTreeSchema } from "./loop-names";
import { flowsByNodeSchema, type FlowsByNode } from "./actions/storage";
import { ITEM_STATUSES, isLive, scheduledAtSchema } from "./status";
import { pageParamSchema } from "./params";
import { evaluateRules, ruleSetSchema, ruleSpecificity, type RuleContext } from "./rules";

// Templates (docs/templates-and-themes.md section 4): a header, a footer and a 404 page in v1.
// They are edited on the same canvas as pages and applied to pages by rules.

export const TEMPLATE_TYPES = ["header", "footer", "error-404", "toast"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  header: "Header",
  footer: "Footer",
  "error-404": "404 page",
  toast: "Toast"
};
export const templateTypeSchema = z.enum(TEMPLATE_TYPES);

/** Whether a page or template shows the header or footer that applies, none, or one specific template. */
export const layoutChoiceSchema = z.string().max(64).default("auto");
export const LAYOUT_AUTO = "auto";
export const LAYOUT_NONE = "none";

export const emptyRules = () => ({ id: "root", match: "all" as const, items: [] });

const cssLengthSchema = z
  .string()
  .max(40)
  .refine(
    (v) => v === "" || /^-?(\d+\.?\d*|\.\d+)(px|rem|em|%|vw|vh|dvh|svh|lvh|vmin|vmax|ch)?$/.test(v),
    "Use a number with a unit, such as 80px or 5rem"
  );

/** Sticky header behavior, only used by header templates (runtime `startStickyHeaders`). */
export const stickyHeaderSchema = z.object({
  enabled: z.boolean().default(false),
  /** The header sticks to the top after the page scrolled this far. */
  stickyAfter: cssLengthSchema.default("0px"),
  /** The header slides away after the page scrolled this far; empty never slides it away. */
  slideAfter: cssLengthSchema.default("200px"),
  /** Id from CSS_ANIMATIONS, played forward to hide the header and in reverse to show it. */
  animation: z.string().max(40).default("slide-out-up"),
  /** Milliseconds. */
  duration: z.number().int().min(0).max(5000).default(300),
  /** Past the slide distance, the header hides on scroll down and comes back on scroll up. */
  onScroll: z.boolean().default(false)
});
export type StickyHeader = z.infer<typeof stickyHeaderSchema>;

export const templateSettingsSchema = z.object({
  description: z.string().max(500).default(""),
  /**
   * Where it applies. A template with no conditions never shows (add Whole site to use it
   * everywhere), even when a page or action picks it. Not used by the 404 template.
   */
  rules: ruleSetSchema.default(emptyRules()),
  /** Higher wins when more than one template of a type matches. */
  priority: z.number().int().min(0).max(1000).default(0),
  /** Forced theme id; null follows the page. */
  themeId: z.string().max(64).nullable().default(null),
  /** Draft templates are never applied; scheduled ones apply from their time. */
  status: z.enum(ITEM_STATUSES).default("draft"),
  scheduledAt: scheduledAtSchema,
  /** Header templates only. */
  sticky: stickyHeaderSchema.default({}),
  /** A 404 template may hide the header or footer. */
  header: layoutChoiceSchema,
  footer: layoutChoiceSchema,
  categoryIds: z.array(z.string().max(64)).max(50).default([]),
  tagIds: z.array(z.string().max(64)).max(50).default([]),
  /** Values the template's elements read as {{ param.* }}; Show Toast passes them. */
  params: z.array(pageParamSchema).max(20).default([]),
  /** Toast templates only: how long a toast stays before it closes by itself. */
  closeAfterMs: z.number().int().min(1000).max(60_000).default(5000)
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
  tree: pageTreeSchema,
  version: z.number().int().min(1),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Template = z.infer<typeof templateSchema>;

export const saveTemplateInputSchema = z.object({
  baseVersion: z.number().int().min(1),
  name: templateNameSchema.optional(),
  settings: templateSettingsSchema.optional(),
  tree: pageTreeSchema.optional(),
  /** Flows of pasted or duplicated elements, written for elements that have none yet. */
  flows: flowsByNodeSchema.optional()
});
export type SaveTemplateInput = z.infer<typeof saveTemplateInputSchema>;

export function defaultTemplateSettings(): TemplateSettings {
  return templateSettingsSchema.parse({});
}

/** What a visitor sees: the template as it was when the project was published. */
export type PublishedTemplate = Pick<Template, "id" | "type" | "name" | "settings" | "tree"> & {
  /** Action flows by element id (absent in snapshots published before Phase 5). */
  flows?: FlowsByNode;
};

export interface LayoutCandidate {
  id: string;
  type: TemplateType;
  name: string;
  settings: Pick<TemplateSettings, "priority" | "status" | "rules"> & {
    scheduledAt?: string | null;
    sticky?: StickyHeader;
  };
}

const liveAt = (t: LayoutCandidate, ctx: RuleContext): boolean =>
  isLive(
    { status: t.settings.status, scheduledAt: t.settings.scheduledAt ?? null },
    Date.parse(ctx.nowIso) || Date.now()
  );

/** A template shows only when it is live and has conditions that hold (no conditions, no show). */
export const templateApplies = (t: LayoutCandidate, ctx: RuleContext): boolean =>
  liveAt(t, ctx) && t.settings.rules.items.length > 0 && evaluateRules(t.settings.rules, ctx);

export type LayoutSlot = "header" | "footer";
export type LayoutReason = "chosen" | "rules" | "none-chosen" | "none-matched";

export interface LayoutDecision {
  slot: LayoutSlot;
  template: LayoutCandidate | null;
  reason: LayoutReason;
}

/** Highest priority, then the narrowest rules, then name, so the result never depends on list order. */
function pickBest<T extends LayoutCandidate>(list: readonly T[], ctx: RuleContext): T | null {
  const matching = list.filter((t) => templateApplies(t, ctx));
  matching.sort(
    (a, b) =>
      b.settings.priority - a.settings.priority ||
      ruleSpecificity(b.settings.rules) - ruleSpecificity(a.settings.rules) ||
      a.name.localeCompare(b.name)
  );
  return matching[0] ?? null;
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
    const chosen = own.find((t) => t.id === choice && templateApplies(t, ctx));
    if (chosen) return { template: chosen, decision: { slot, template: chosen, reason: "chosen" } };
  }
  const best = pickBest(own, ctx);
  if (!best) return { template: null, decision: { slot, template: null, reason: "none-matched" } };
  return { template: best, decision: { slot, template: best, reason: "rules" } };
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
  // The 404 template has no conditions: the best published one applies.
  return (
    templates
      .filter((t) => t.type === "error-404" && liveAt(t, ctx))
      .sort(
        (a, b) => b.settings.priority - a.settings.priority || a.name.localeCompare(b.name)
      )[0] ?? null
  );
}

/** The toast template a Show Toast action names, when it is a live toast template whose conditions hold. */
export function resolveToast<T extends LayoutCandidate>(
  templates: readonly T[],
  ctx: RuleContext,
  templateId: string
): T | null {
  return (
    templates.find((t) => t.id === templateId && t.type === "toast" && templateApplies(t, ctx)) ??
    null
  );
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
      case "none-chosen":
        return `${label}: none, this page turns it off.`;
      default:
        return `${label}: none, no published ${slot} template has conditions that match this page.`;
    }
  });
}
