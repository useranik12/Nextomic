import {
  breakpointCascade,
  walkElements,
  type BreakpointDef,
  type ElementNode,
  type PseudoState,
  type StyleMap
} from "@nextomic/schema";

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

/** Minimal base for built pages. The editor canvas uses the same rules so it matches the output. */
export const BASE_CSS =
  "*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{display:flow-root;background:#fff;color:#111;font-family:system-ui,sans-serif}";

export function isSafeCssValue(value: string): boolean {
  return value.trim() !== "" && !UNSAFE_VALUE.test(value);
}

export function elementSelector(nodeId: string): string {
  return `[data-nid="${nodeId.replace(/[^A-Za-z0-9_-]/g, "")}"]`;
}

function declarations(styles: Record<string, string>): string {
  return Object.entries(styles)
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
export function elementCss(node: ElementNode, breakpoints: readonly BreakpointDef[]): string {
  return stylesCss(elementSelector(node.id), node.styles, breakpoints);
}

/** CSS for a class, same cascade order as an element. */
export function classCss(
  name: string,
  styles: StyleMap,
  breakpoints: readonly BreakpointDef[]
): string {
  return stylesCss(classSelector(name), styles, breakpoints);
}

function stylesCss(
  selector: string,
  styles: StyleMap,
  breakpoints: readonly BreakpointDef[]
): string {
  const out: string[] = [];
  for (const def of breakpointCascade(breakpoints)) {
    const byState = styles.breakpoints[def.id];
    if (!byState) continue;
    const media = mediaQuery(def);
    const rules: string[] = [];
    for (const state of STATE_ORDER) {
      const body = declarations(byState[state] ?? {});
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
  classes: Readonly<Record<string, StyleMap>> = {}
): string {
  const chunks: string[] = [];
  for (const [name, styles] of Object.entries(classes)) {
    const css = classCss(name, styles, breakpoints);
    if (css) chunks.push(css);
  }
  walkElements(root, (node) => {
    const css = elementCss(node, breakpoints);
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
