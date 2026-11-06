import { parse, type AtRule, type Container } from "postcss";
import { walkElements, type ElementNode } from "./element";

/** Names of every class applied to an element of the given trees (hidden elements included). */
export function usedClassNames(...roots: readonly ElementNode[]): Set<string> {
  const used = new Set<string>();
  for (const root of roots) {
    walkElements(root, (node) => {
      for (const name of node.classIds) used.add(name);
    });
  }
  return used;
}

const FUNCTIONAL_PSEUDO = /:(?:not|is|where|has|matches|-webkit-any|-moz-any)\([^()]*\)/g;
const ATTRIBUTE = /\[[^\]]*\]/g;
const CLASS_REF = /\.((?:\\.|[\w-])+)/g;

/**
 * The classes a selector needs before it can match. Classes inside `:not()`, `:is()`, `:where()`
 * and `:has()` do not count: they never make a selector depend on a class being present.
 */
export function requiredClasses(selector: string): string[] {
  let text = selector.replace(ATTRIBUTE, "");
  for (let before = ""; before !== text; ) {
    before = text;
    text = text.replace(FUNCTIONAL_PSEUDO, "");
  }
  return [...text.matchAll(CLASS_REF)].flatMap((m) => {
    const name = m[1];
    return name === undefined ? [] : [name.replace(/\\(.)/g, "$1")];
  });
}

const GROUPING_AT_RULES = /^(media|supports|layer|container|scope|document)$/i;
const CACHE_LIMIT = 24;
const cache = new Map<string, string>();

function dropEmpty(container: Container): void {
  container.walkAtRules((rule: AtRule) => {
    if (GROUPING_AT_RULES.test(rule.name) && rule.nodes && rule.nodes.length === 0) rule.remove();
  });
}

/**
 * Removes the rules of classes that no element uses. A rule stays when it has no class in its
 * selector (`:root`, `body`, `*`, tags) or when every class one of its selectors needs is used.
 * `@keyframes` and `@font-face` always stay, and so does anything this cannot parse (the CSS is
 * returned unchanged rather than guessed at). Never apply this to the editor canvas: a class added
 * while editing must show at once.
 */
export function pruneUnusedClasses(css: string, used: ReadonlySet<string>): string {
  if (css.trim() === "") return css;
  const key = `${[...used].sort().join(" ")}\u0000${css}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let result = css;
  try {
    const root = parse(css);
    root.walkRules((rule) => {
      const parent = rule.parent;
      if (parent?.type === "atrule" && /keyframes$/i.test((parent as AtRule).name)) return;
      const keep = rule.selectors.filter((s) => requiredClasses(s).every((c) => used.has(c)));
      if (keep.length === 0) rule.remove();
      else if (keep.length !== rule.selectors.length) rule.selectors = keep;
    });
    dropEmpty(root);
    result = root.toString();
  } catch {
    result = css;
  }
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}
