import { parse } from "postcss";
import type { BreakpointDef } from "./breakpoint";
import { parseStyleCss, styleMapToCss } from "./css-text";
import { CLASS_NAME_PATTERN } from "./element";
import type { StyleMap } from "./style";

// Export and import of project classes as a plain CSS file. Import takes simple class rules
// (`.name`, `.name:hover` ...) at the top level and inside the project's breakpoint media queries;
// everything else is counted as skipped so nothing is silently changed.

/** All project classes as CSS, one class after another in name order. */
export function exportClassesCss(
  classes: Readonly<Record<string, StyleMap>>,
  breakpoints: readonly BreakpointDef[]
): string {
  return Object.keys(classes)
    .sort()
    .map((name) => styleMapToCss(classes[name] as StyleMap, `.${name}`, breakpoints))
    .filter((css) => css.trim() !== "")
    .join("\n\n");
}

export type ClassImport =
  | { ok: true; classes: Record<string, StyleMap>; skipped: number }
  | { ok: false; error: string };

const SIMPLE = /^\.(-?[_a-zA-Z][\w-]*)(?::(?:hover|focus|active|disabled))?$/;

function classOf(selector: string): string | null {
  const name = SIMPLE.exec(selector.trim())?.[1];
  return name && CLASS_NAME_PATTERN.test(name) && name.length <= 64 ? name : null;
}

/** Reads the simple class rules of a CSS file. Rules it cannot model are counted in `skipped`. */
export function importClassesCss(css: string, breakpoints: readonly BreakpointDef[]): ClassImport {
  let root;
  try {
    root = parse(css);
  } catch (error) {
    return { ok: false, error: (error as { reason?: string }).reason ?? "Invalid CSS." };
  }
  const names = new Set<string>();
  let total = 0;
  root.walkRules((rule) => {
    total += 1;
    const name = classOf(rule.selector);
    if (name) names.add(name);
  });

  const classes: Record<string, StyleMap> = {};
  let imported = 0;
  for (const name of names) {
    const copy = root.clone();
    copy.walkRules((rule) => {
      if (classOf(rule.selector) !== name) rule.remove();
    });
    copy.walkAtRules((rule) => {
      if (rule.name !== "media" || !rule.nodes || rule.nodes.length === 0) rule.remove();
    });
    const result = parseStyleCss(copy.toString(), `.${name}`, breakpoints);
    if (!result.ok) continue;
    // A media query the project has no breakpoint for lands in `raw`; keep it out of the import.
    if (result.styles.raw) delete result.styles.raw;
    let kept = 0;
    copy.walkRules(() => void (kept += 1));
    imported += kept;
    classes[name] = result.styles;
  }
  return { ok: true, classes, skipped: Math.max(0, total - imported) };
}
