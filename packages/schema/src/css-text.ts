import { parse, type AtRule, type ChildNode, type Declaration, type Rule } from "postcss";
import { breakpointCascade, type BreakpointDef } from "./breakpoint";
import {
  CSS_PROPERTY_PATTERN,
  type PseudoState,
  type StyleDeclarations,
  type StyleMap
} from "./style";

// The CSS text view of a StyleMap (docs/design-system.md section 4). `styleMapToCss` prints it and
// `parseStyleCss` reads it back. Anything the map cannot model (other selectors, other at-rules,
// comments, vendor properties) goes to `raw` and is printed again verbatim, never dropped.

const STATES: PseudoState[] = ["default", "hover", "focus", "active", "disabled"];
const SUFFIX: Record<PseudoState, string> = {
  default: "",
  hover: ":hover",
  focus: ":focus",
  active: ":active",
  disabled: ":disabled"
};
const MAX_VALUE = 2000;

export type CssParseResult =
  | { ok: true; styles: StyleMap }
  | { ok: false; error: string; line: number | null };

function mediaFor(def: BreakpointDef): string | null {
  if (def.kind === "base" || def.width === null) return null;
  return `(${def.kind === "down" ? "max" : "min"}-width: ${def.width}px)`;
}

/** Selector shown in the CSS editor for an element: its ID when it has one. */
export function elementSelectorLabel(node: { id: string; htmlId?: string | undefined }): string {
  return node.htmlId ? `#${node.htmlId}` : `[data-nid="${node.id}"]`;
}

const squash = (text: string): string => text.replace(/\s+/g, "").toLowerCase();

function block(selector: string, declarations: StyleDeclarations, indent: string): string {
  const lines = Object.entries(declarations).map(([p, v]) => `${indent}  ${p}: ${v};`);
  return `${indent}${selector} {\n${lines.join("\n")}\n${indent}}`;
}

/** Prints the styles for one target. Order follows the cascade: base, "up" ascending, "down" descending. */
export function styleMapToCss(
  styles: StyleMap,
  selector: string,
  breakpoints: readonly BreakpointDef[]
): string {
  const out: string[] = [];
  for (const def of breakpointCascade(breakpoints)) {
    const byState = styles.breakpoints[def.id];
    if (!byState) continue;
    const media = mediaFor(def);
    const rules: string[] = [];
    for (const state of STATES) {
      const declarations = byState[state];
      if (declarations && Object.keys(declarations).length > 0) {
        rules.push(block(selector + SUFFIX[state], declarations, media ? "  " : ""));
      }
    }
    if (rules.length === 0) continue;
    out.push(media ? `@media ${media} {\n${rules.join("\n\n")}\n}` : rules.join("\n\n"));
  }
  if (styles.raw?.trim()) out.push(styles.raw.trim());
  return out.join("\n\n");
}

interface Context {
  selector: string;
  mediaByParams: Map<string, string>;
  breakpoints: Record<string, Record<string, StyleDeclarations>>;
  raw: string[];
}

function stateFor(ctx: Context, selector: string): PseudoState | null {
  const flat = selector.replace(/\s+/g, "");
  return STATES.find((state) => flat === ctx.selector + SUFFIX[state]) ?? null;
}

const text = (node: ChildNode): string => node.toString().trim();

function valueOf(decl: Declaration): string {
  return decl.important ? `${decl.value} !important` : decl.value;
}

/** Collects a rule's declarations into the map, or returns false when the rule is not modelable. */
function takeRule(ctx: Context, rule: Rule, breakpointId: string): boolean {
  const state = stateFor(ctx, rule.selector);
  if (!state) return false;
  const found: StyleDeclarations = {};
  for (const child of rule.nodes) {
    if (child.type !== "decl") return false;
    const property = child.prop.startsWith("--") ? child.prop : child.prop.toLowerCase();
    const value = valueOf(child);
    if (!CSS_PROPERTY_PATTERN.test(property) || value.length > MAX_VALUE) return false;
    found[property] = value;
  }
  if (Object.keys(found).length === 0) return true;
  const byState = (ctx.breakpoints[breakpointId] ??= {});
  byState[state] = { ...byState[state], ...found };
  return true;
}

function takeAtRule(ctx: Context, atRule: AtRule): void {
  const breakpointId =
    atRule.name.toLowerCase() === "media"
      ? ctx.mediaByParams.get(squash(atRule.params))
      : undefined;
  if (!breakpointId || !atRule.nodes) {
    ctx.raw.push(text(atRule));
    return;
  }
  for (const child of atRule.nodes) {
    if (child.type === "rule" && takeRule(ctx, child, breakpointId)) continue;
    ctx.raw.push(`@media ${atRule.params.trim()} {\n  ${text(child).replace(/\n/g, "\n  ")}\n}`);
  }
}

/** Reads CSS text for one target back into a StyleMap. Invalid CSS returns an error, never a partial map. */
export function parseStyleCss(
  css: string,
  selector: string,
  breakpoints: readonly BreakpointDef[]
): CssParseResult {
  let root;
  try {
    root = parse(css);
  } catch (error) {
    const e = error as { reason?: string; line?: number };
    return { ok: false, error: e.reason ?? "Invalid CSS", line: e.line ?? null };
  }
  const mediaByParams = new Map<string, string>();
  for (const def of breakpoints) {
    const media = mediaFor(def);
    if (media) mediaByParams.set(squash(media), def.id);
  }
  const ctx: Context = { selector, mediaByParams, breakpoints: {}, raw: [] };
  for (const node of root.nodes) {
    if (node.type === "rule") {
      if (!takeRule(ctx, node, "base")) ctx.raw.push(text(node));
    } else if (node.type === "atrule") {
      takeAtRule(ctx, node);
    } else if (node.type === "decl") {
      // Bare declarations are shorthand for the base, default state.
      const wrapped = parse(`${selector}{${node.toString()}}`).first;
      if (!wrapped || wrapped.type !== "rule" || !takeRule(ctx, wrapped, "base")) {
        ctx.raw.push(`${selector} { ${text(node)} }`);
      }
    } else {
      ctx.raw.push(text(node));
    }
  }
  const styles: StyleMap = { breakpoints: ctx.breakpoints };
  if (ctx.raw.length > 0) styles.raw = ctx.raw.join("\n\n");
  return { ok: true, styles };
}
