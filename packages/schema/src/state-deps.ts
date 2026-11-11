import { elementConditionRefs, hasConditions } from "./condition";
import { walkElements, type ElementNode } from "./element";

// Which elements read which state (docs/dynamic-data-and-actions.md section 5): built pages redraw
// only those elements when an action changes app or page state.

const TAG = /\{\{([\s\S]*?)\}\}/g;
const REF = /\b(app|state)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g;

/** The state names ("app.cart", "state.open") the {{ tags }} of a text read. */
export function stateRefs(text: string): string[] {
  const found = new Set<string>();
  for (const tag of text.matchAll(TAG)) {
    for (const ref of (tag[1] ?? "").matchAll(REF)) found.add(`${ref[1]}.${ref[2]}`);
  }
  return [...found];
}

/** Per element id, the state names (and "el.<id>" edits of other elements) its own props, attributes, styles, conditions and query read. */
export function stateDependencies(root: ElementNode): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  walkElements(root, (node) => {
    const own = JSON.stringify([
      node.props,
      node.attributes,
      node.styles,
      node.visibility,
      node.query
    ]);
    const refs = stateRefs(own);
    if (hasConditions(node.visibility))
      refs.push(...elementConditionRefs(node.visibility.group, node.id));
    if (refs.length > 0) out[node.id] = refs;
  });
  return out;
}
