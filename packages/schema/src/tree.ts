import {
  collectHtmlIds,
  generateHtmlId,
  newElementId,
  walkElements,
  type ElementNode
} from "./element";
import type { PseudoState, StyleMap } from "./style";
import type { PropValue } from "./value";

// Pure tree operations. They mutate the tree they are given, so the editor store runs them
// inside an Immer draft and tests run them on a structuredClone.

export interface NodeLocation {
  node: ElementNode;
  parent: ElementNode | null;
  index: number;
}

export function findNode(root: ElementNode, id: string): NodeLocation | null {
  if (root.id === id) return { node: root, parent: null, index: 0 };
  for (let i = 0; i < root.children.length; i += 1) {
    const child = root.children[i];
    if (!child) continue;
    if (child.id === id) return { node: child, parent: root, index: i };
    const deeper = findNode(child, id);
    if (deeper) return deeper;
  }
  return null;
}

export function containsNode(ancestor: ElementNode, id: string): boolean {
  return findNode(ancestor, id) !== null;
}

export type CanHaveChildren = (type: string) => boolean;

export function insertNode(
  root: ElementNode,
  parentId: string,
  node: ElementNode,
  index: number | undefined,
  canHaveChildren: CanHaveChildren
): boolean {
  const parent = findNode(root, parentId)?.node;
  if (!parent || !canHaveChildren(parent.type)) return false;
  const at =
    index === undefined
      ? parent.children.length
      : Math.max(0, Math.min(index, parent.children.length));
  parent.children.splice(at, 0, node);
  return true;
}

export function removeNode(root: ElementNode, id: string): ElementNode | null {
  const location = findNode(root, id);
  if (!location?.parent) return null;
  const [removed] = location.parent.children.splice(location.index, 1);
  return removed ?? null;
}

/** Moves a node under a new parent. Refuses the root, a missing parent, a leaf parent, or a cycle. */
export function moveNode(
  root: ElementNode,
  id: string,
  newParentId: string,
  index: number,
  canHaveChildren: CanHaveChildren
): boolean {
  const source = findNode(root, id);
  if (!source?.parent) return false;
  if (containsNode(source.node, newParentId)) return false;
  const target = findNode(root, newParentId)?.node;
  if (!target || !canHaveChildren(target.type)) return false;
  source.parent.children.splice(source.index, 1);
  // Removing from the same parent before the target index shifts it left by one.
  const adjusted = source.parent === target && source.index < index ? index - 1 : index;
  const at = Math.max(0, Math.min(adjusted, target.children.length));
  target.children.splice(at, 0, source.node);
  return true;
}

/** Deep copy with fresh internal ids. htmlIds are regenerated (or dropped) so they stay unique. */
export function cloneWithNewIds(
  node: ElementNode,
  taken: Set<string>,
  generateElementIds: boolean
): ElementNode {
  const copy: ElementNode = JSON.parse(JSON.stringify(node));
  walkElements(copy, (item) => {
    item.id = newElementId();
    if (item.htmlId) {
      delete item.htmlId;
    }
    if (generateElementIds) {
      const htmlId = generateHtmlId(taken);
      taken.add(htmlId);
      item.htmlId = htmlId;
    }
  });
  return copy;
}

export function duplicateNode(
  root: ElementNode,
  id: string,
  generateElementIds: boolean
): ElementNode | null {
  const location = findNode(root, id);
  if (!location?.parent) return null;
  const copy = cloneWithNewIds(location.node, collectHtmlIds(root), generateElementIds);
  location.parent.children.splice(location.index + 1, 0, copy);
  return copy;
}

export function setProp(node: ElementNode, key: string, value: PropValue): void {
  node.props[key] = value;
}

/** Sets a style declaration, or removes it when `value` is null. Empty maps are pruned. */
export function setStyle(
  node: { styles: StyleMap },
  breakpointId: string,
  state: PseudoState,
  property: string,
  value: string | null
): void {
  const byBreakpoint = node.styles.breakpoints;
  if (value === null) {
    const byState = byBreakpoint[breakpointId];
    if (!byState?.[state]) return;
    delete byState[state][property];
    if (Object.keys(byState[state]).length === 0) delete byState[state];
    if (Object.keys(byState).length === 0) delete byBreakpoint[breakpointId];
    return;
  }
  const byState = (byBreakpoint[breakpointId] ??= {});
  const declarations = (byState[state] ??= {});
  declarations[property] = value;
}

export function getStyle(
  node: { styles: StyleMap },
  breakpointId: string,
  state: PseudoState,
  property: string
): string | undefined {
  return node.styles.breakpoints[breakpointId]?.[state]?.[property];
}

/** Moves or drops styles when a breakpoint is deleted. */
export function reassignBreakpointStyles(
  root: ElementNode,
  fromId: string,
  toId: string | null
): void {
  walkElements(root, (node) => {
    const source = node.styles.breakpoints[fromId];
    if (!source) return;
    delete node.styles.breakpoints[fromId];
    if (toId === null) return;
    const target = (node.styles.breakpoints[toId] ??= {});
    for (const [state, declarations] of Object.entries(source) as [
      PseudoState,
      Record<string, string>
    ][]) {
      target[state] = { ...declarations, ...(target[state] ?? {}) };
    }
  });
}

export function anyStylesAt(root: ElementNode, breakpointId: string): boolean {
  let found = false;
  walkElements(root, (node) => {
    const byState = node.styles.breakpoints[breakpointId];
    if (byState && Object.values(byState).some((d) => Object.keys(d).length > 0)) found = true;
  });
  return found;
}

/** Gives every element without an htmlId a unique one (used when the project toggle is turned on). */
export function assignMissingHtmlIds(root: ElementNode): void {
  const taken = collectHtmlIds(root);
  walkElements(root, (node) => {
    if (node.type === "page" || node.htmlId) return;
    const id = generateHtmlId(taken);
    taken.add(id);
    node.htmlId = id;
  });
}
