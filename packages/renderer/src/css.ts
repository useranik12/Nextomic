import type { TokenResolver } from "./values";
import {
  breakpointCascade,
  walkElements,
  type BreakpointDef,
  type ElementNode,
  type PseudoState,
  type StyleMap
} from "@nextomic/schema";
import { getElementDefinition } from "./registry";

const PSEUDO_SELECTOR: Record<PseudoState, string> = {
  default: "",
  hover: ":hover",
  focus: ":focus",
  active: ":active",
  disabled: ":disabled"
};
const STATE_ORDER: PseudoState[] = ["default", "hover", "focus", "active", "disabled"];

// A declaration value that could close the rule or open another one is dropped, never escaped.
const UNSAFE_VALUE = /[{};<>]|\/\*|\*\/|@import|expression\(|javascript:/i;

/** Container tags that start as a column flexbox; any style set on them wins. */
export const FLEX_COLUMN_TAGS = [
  "div",
  "section",
  "header",
  "main",
  "nav",
  "aside",
  "article",
  "footer"
];
const FLEX_COLUMN_DEFAULT: Record<string, string> = { display: "flex", "flex-direction": "column" };

/** The built-in value of a style property for an element (before any style is set), if it has one. */
export function builtinStyle(
  node: Pick<ElementNode, "type" | "htmlTag">,
  property: string
): string | undefined {
  if (!getElementDefinition(node.type)?.canHaveChildren) return undefined;
  const tag = node.htmlTag ?? (node.type === "section" ? "section" : "div");
  return FLEX_COLUMN_TAGS.includes(tag) ? FLEX_COLUMN_DEFAULT[property] : undefined;
}

/** Minimal base for built pages. The editor canvas uses the same rules so it matches the output. */
export const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}html,body{margin:0}:where(h1,h2,h3,h4,h5,h6,p,blockquote,figure,pre,ul,ol,dl,dd){margin:0}:where([data-nid]:is(${FLEX_COLUMN_TAGS.join(",")})){display:flex;flex-direction:column}body{display:flow-root;background:#fff;color:#111;font-family:system-ui,sans-serif}.nxt-skip-link{position:absolute;left:8px;top:-48px;z-index:1000;padding:8px 14px;border-radius:8px;background:#111;color:#fff;text-decoration:none}.nxt-skip-link:focus{top:8px}.nxt-sticky-fixed{position:fixed;top:0;left:0;right:0;z-index:100}.nxt-404{min-height:100vh;align-items:center;justify-content:center;text-align:center;gap:8px}`;

export function isSafeCssValue(value: string): boolean {
  return value.trim() !== "" && !UNSAFE_VALUE.test(value);
}

export function elementSelector(nodeId: string): string {
  return `[data-nid="${nodeId.replace(/[^A-Za-z0-9_-]/g, "")}"]`;
}

const STYLE_TOKEN = /\{\{\s+([^{}]+?)\s+\}\}/g;

/** Replaces {{tokens}} in a style value with their text. Without a resolver a tokened value is dropped. */
function resolveStyleValue(value: string, resolve: TokenResolver | undefined): string {
  if (!value.includes("{{")) return value;
  return resolve ? value.replace(STYLE_TOKEN, (_, token: string) => resolve(token)) : "";
}

function declarations(styles: Record<string, string>, resolve?: TokenResolver): string {
  return Object.entries(styles)
    .map(([property, value]) => [property, resolveStyleValue(value, resolve)] as const)
    .filter(([, value]) => isSafeCssValue(value))
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
}

function mediaQuery(def: BreakpointDef): string | null {
  if (def.kind === "base" || def.width === null) return null;
  return def.kind === "down" ? `(max-width:${def.width}px)` : `(min-width:${def.width}px)`;
}

export function classSelector(name: string): string {
  return `.${name.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

/** CSS for one element: base first, then "up" ascending, then "down" descending (cascade order). */
export function elementCss(
  node: ElementNode,
  breakpoints: readonly BreakpointDef[],
  resolve?: TokenResolver
): string {
  return stylesCss(elementSelector(node.id), node.styles, breakpoints, resolve);
}

/** CSS for a class, same cascade order as an element. */
export function classCss(
  name: string,
  styles: StyleMap,
  breakpoints: readonly BreakpointDef[],
  resolve?: TokenResolver
): string {
  return stylesCss(classSelector(name), styles, breakpoints, resolve);
}

function stylesCss(
  selector: string,
  styles: StyleMap,
  breakpoints: readonly BreakpointDef[],
  resolve?: TokenResolver
): string {
  const out: string[] = [];
  for (const def of breakpointCascade(breakpoints)) {
    const byState = styles.breakpoints[def.id];
    if (!byState) continue;
    const media = mediaQuery(def);
    const rules: string[] = [];
    for (const state of STATE_ORDER) {
      const body = declarations(byState[state] ?? {}, resolve);
      if (body) rules.push(`${selector}${PSEUDO_SELECTOR[state]}{${body}}`);
    }
    if (rules.length === 0) continue;
    out.push(media ? `@media ${media}{${rules.join("")}}` : rules.join(""));
  }
  // CSS the structured map cannot hold is kept verbatim; it must not be able to close the <style> tag.
  if (styles.raw && !/<\/style/i.test(styles.raw)) out.push(styles.raw);
  return out.join("");
}

/** Class rules come first so an element's own styles (its ID) win over its classes. */
export function pageCss(
  root: ElementNode,
  breakpoints: readonly BreakpointDef[],
  classes: Readonly<Record<string, StyleMap>> = {},
  resolve?: TokenResolver
): string {
  const chunks: string[] = [];
  for (const [name, styles] of Object.entries(classes)) {
    const css = classCss(name, styles, breakpoints, resolve);
    if (css) chunks.push(css);
  }
  walkElements(root, (node) => {
    const css = elementCss(node, breakpoints, resolve);
    if (css) chunks.push(css);
  });
  return chunks.join("\n");
}

/** True when the element has any style at this breakpoint (any state). Drives change dots. */
export function hasStylesAt(node: ElementNode, breakpointId: string): boolean {
  const byState = node.styles.breakpoints[breakpointId];
  if (!byState) return false;
  return Object.values(byState).some((decls) => Object.keys(decls).length > 0);
}
