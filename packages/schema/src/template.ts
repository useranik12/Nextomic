import { z } from "zod";
import { pageTreeSchema } from "./loop-names";
import { flowsByNodeSchema, type FlowsByNode } from "./actions/storage";
import { ITEM_STATUSES, isLive, scheduledAtSchema } from "./status";
import { pageParamSchema } from "./params";
import { CSS_ANIMATIONS } from "./css-animation";
import { evaluateRules, ruleSetSchema, ruleSpecificity, type RuleContext } from "./rules";

// Templates (docs/templates-and-themes.md section 4): a header, a footer and a 404 page in v1.
// They are edited on the same canvas as pages and applied to pages by rules.

export const TEMPLATE_TYPES = ["header", "footer", "error-404", "modal", "bottom-sheet"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  header: "Header",
  footer: "Footer",
  "error-404": "404 page",
  modal: "Modal",
  "bottom-sheet": "Bottom Sheet"
};

/** Types an action shows over the page, each with its own overlay (not header, footer or 404). */
export type OverlayTemplateType = "modal" | "bottom-sheet";
export const isOverlayType = (type: TemplateType): type is OverlayTemplateType =>
  type === "modal" || type === "bottom-sheet";

/**
 * Stacking bands for everything shown over the page, top to bottom: toast, modal, bottom sheet.
 * Inside a band, the template setting "Show above" adds a rank (`overlayRanks`).
 */
export const Z_BANDS = { toast: 20_000, modal: 15_000, "bottom-sheet": 10_000 } as const;
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

/** The layer behind a modal or bottom sheet. */
export const overlaySchema = z.object({
  disabled: z.boolean().default(false),
  /** Any CSS color. */
  color: z
    .string()
    .max(80)
    .refine((v) => !/[{};<>]/.test(v), "That color has characters that are not allowed")
    .default("rgb(0 0 0 / 0.1)"),
  /** 0 to 1, multiplies the color. */
  opacity: z.number().min(0).max(1).default(1)
});
export type Overlay = z.infer<typeof overlaySchema>;

/** Bottom sheet entrance: an "up" animation from CSS_ANIMATIONS. */
export const sheetEntrySchema = z.object({
  animation: z.string().max(40).default("slide-in-up"),
  /** Milliseconds. */
  durationMs: z.number().int().min(0).max(5000).default(300),
  delayMs: z.number().int().min(0).max(5000).default(100)
});
export type SheetEntry = z.infer<typeof sheetEntrySchema>;

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
  /** Modal and bottom sheet only: the layer behind the template. */
  overlay: overlaySchema.default({}),
  /** Modal and bottom sheet only: other templates of the same type this one sits above. */
  showAbove: z.array(z.string().max(64)).max(50).default([]),
  /** Bottom sheet only: how it slides in. */
  entry: sheetEntrySchema.default({})
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
    showAbove?: string[];
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

/** The modal or bottom sheet template an action names, when it is live and its conditions hold. */
export function resolveOverlay<T extends LayoutCandidate>(
  templates: readonly T[],
  ctx: RuleContext,
  templateId: string,
  type: OverlayTemplateType
): T | null {
  return (
    templates.find((t) => t.id === templateId && t.type === type && templateApplies(t, ctx)) ?? null
  );
}

/**
 * Rank of every template of one type: 0 without "Show above", else one more than the highest rank
 * among the templates it sits above. A cycle counts as rank 0 for the template that closes it.
 */
export function overlayRanks(
  templates: readonly { id: string; settings: { showAbove?: readonly string[] } }[]
): Record<string, number> {
  const above = new Map(templates.map((t) => [t.id, t.settings.showAbove ?? []]));
  const ranks: Record<string, number> = {};
  const visiting = new Set<string>();
  const rank = (id: string): number => {
    const known = ranks[id];
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let value = 0;
    for (const other of above.get(id) ?? [])
      if (above.has(other)) value = Math.max(value, rank(other) + 1);
    visiting.delete(id);
    ranks[id] = value;
    return value;
  };
  for (const id of above.keys()) rank(id);
  return ranks;
}

/** z-index of an overlay: its band, 100 per rank, plus its open order (later opened sits above). */
export const overlayZIndex = (
  type: OverlayTemplateType | "toast",
  rank: number,
  openOrder: number
): number => Z_BANDS[type] + Math.min(rank, 49) * 100 + Math.min(openOrder, 99);

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

/** Entrance animations that move up (fade-in-up, slide-in-up, ...): the choices for a bottom sheet. */
export const SHEET_ENTRY_ANIMATIONS = CSS_ANIMATIONS.filter(
  (a) => a.entrance && a.id.includes("-in-up")
);
