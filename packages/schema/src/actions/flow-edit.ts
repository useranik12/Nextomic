import type { ConditionGroup } from "../condition";
import { walkFlow, type FlowNode, type FlowNodeKind } from "./flow";

// Pure edits of a node list for the flow editor. Every function returns a new list; the input is
// never changed. A slot names one child list: the top list (parent null, "nodes"), or a list of a
// container ("nodes" of a loop, "branch:<id>", "else", "lane:<id>", "try", "catch").

export interface FlowSlot {
  parent: string | null;
  list: string;
}

export const TOP_SLOT: FlowSlot = { parent: null, list: "nodes" };

/** The child lists of a node with their slot keys and labels, in display order. */
export function slotLists(node: FlowNode): { list: string; label: string; nodes: FlowNode[] }[] {
  switch (node.kind) {
    case "condition":
      return [
        ...node.branches.map((b, i) => ({
          list: `branch:${b.id}`,
          label: i === 0 ? "If" : "Else if",
          nodes: b.nodes
        })),
        ...(node.else ? [{ list: "else", label: "Else", nodes: node.else }] : [])
      ];
    case "loop":
      return [
        { list: "nodes", label: node.mode === "forEach" ? "For each" : "While", nodes: node.nodes }
      ];
    case "parallel":
      return node.lanes.map((l, i) => ({
        list: `lane:${l.id}`,
        label: `Lane ${i + 1}`,
        nodes: l.nodes
      }));
    case "tryCatch":
      return [
        { list: "try", label: "Try", nodes: node.try },
        { list: "catch", label: "Catch", nodes: node.catch }
      ];
    default:
      return [];
  }
}

/** Replaces one child list of a container (mutates `node`, which must be a copy). */
function setList(node: FlowNode, list: string, nodes: FlowNode[]): void {
  if (node.kind === "condition") {
    if (list === "else") node.else = nodes;
    const branch = node.branches.find((b) => `branch:${b.id}` === list);
    if (branch) branch.nodes = nodes;
  } else if (node.kind === "loop" && list === "nodes") node.nodes = nodes;
  else if (node.kind === "parallel") {
    const lane = node.lanes.find((l) => `lane:${l.id}` === list);
    if (lane) lane.nodes = nodes;
  } else if (node.kind === "tryCatch") {
    if (list === "try") node.try = nodes;
    if (list === "catch") node.catch = nodes;
  }
}

/** Applies `edit` to the list in `slot`; other lists are kept as they are. */
function editSlot(
  nodes: readonly FlowNode[],
  slot: FlowSlot,
  edit: (list: FlowNode[]) => FlowNode[]
): FlowNode[] {
  if (slot.parent === null) return edit([...nodes]);
  return nodes.map((node) => {
    if (node.id === slot.parent) {
      const copy = structuredClone(node);
      const current = slotLists(copy).find((l) => l.list === slot.list);
      if (current) setList(copy, slot.list, edit([...current.nodes]));
      return copy;
    }
    const lists = slotLists(node);
    if (lists.length === 0) return node;
    const copy = structuredClone(node);
    for (const { list, nodes: child } of slotLists(copy))
      setList(copy, list, editSlot(child, slot, edit));
    return copy;
  });
}

export interface FoundFlowNode {
  node: FlowNode;
  slot: FlowSlot;
  index: number;
  /** Containers around the node, outermost first. */
  ancestors: FlowNode[];
}

export function findFlowNode(
  nodes: readonly FlowNode[],
  id: string,
  slot: FlowSlot = TOP_SLOT,
  ancestors: FlowNode[] = []
): FoundFlowNode | null {
  for (const [index, node] of nodes.entries()) {
    if (node.id === id) return { node, slot, index, ancestors };
    for (const { list, nodes: child } of slotLists(node)) {
      const found = findFlowNode(child, id, { parent: node.id, list }, [...ancestors, node]);
      if (found) return found;
    }
  }
  return null;
}

export function insertFlowNode(
  nodes: readonly FlowNode[],
  slot: FlowSlot,
  index: number,
  node: FlowNode
): FlowNode[] {
  return editSlot(nodes, slot, (list) => {
    list.splice(Math.max(0, Math.min(index, list.length)), 0, node);
    return list;
  });
}

export function removeFlowNode(nodes: readonly FlowNode[], id: string): FlowNode[] {
  const found = findFlowNode(nodes, id);
  if (!found) return [...nodes];
  return editSlot(nodes, found.slot, (list) => list.filter((n) => n.id !== id));
}

export function replaceFlowNode(nodes: readonly FlowNode[], next: FlowNode): FlowNode[] {
  const found = findFlowNode(nodes, next.id);
  if (!found) return [...nodes];
  return editSlot(nodes, found.slot, (list) => list.map((n) => (n.id === next.id ? next : n)));
}

/** Moves a node one place up (-1) or down (1) inside its own list. */
export function moveFlowNode(nodes: readonly FlowNode[], id: string, step: -1 | 1): FlowNode[] {
  const found = findFlowNode(nodes, id);
  if (!found) return [...nodes];
  return editSlot(nodes, found.slot, (list) => {
    const to = found.index + step;
    if (to < 0 || to >= list.length) return list;
    const [item] = list.splice(found.index, 1);
    if (item) list.splice(to, 0, item);
    return list;
  });
}

const uid = () => crypto.randomUUID();

/** The last name inside a list's {{ tag }}, made safe for a loop item name. */
function listNameOf(list: string): string {
  const names = list.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return (names.at(-1) ?? "list").slice(0, 40);
}

/**
 * A For Each loop's item name: `loop_<6 chars>_<list name>`. Generated, never typed, so it is
 * unique in the flow. Underscores, not dashes: a dash in an expression is a minus sign.
 */
export function loopItemName(list: string, code = uid().replace(/-/g, "").slice(0, 6)): string {
  return `loop_${code}_${listNameOf(list)}`;
}

/** The 6-character code of a generated item name, kept when the list changes. */
export const loopNameCode = (itemName: string): string | undefined =>
  /^loop_([a-z0-9]{6})_/.exec(itemName)?.[1];
const emptyGroup = (): ConditionGroup => ({ id: uid(), match: "all", items: [] });

/** A new node of a kind, with empty settings. */
export function newFlowNode(kind: FlowNodeKind, blockId = ""): FlowNode {
  const id = uid();
  switch (kind) {
    case "action":
      return { id, kind, type: "", params: {} };
    case "condition":
      return { id, kind, branches: [{ id: uid(), group: emptyGroup(), nodes: [] }], else: [] };
    case "loop":
      return {
        id,
        kind,
        mode: "forEach",
        list: "",
        itemName: loopItemName(""),
        start: "",
        end: "",
        step: "",
        maxIterations: 1000,
        nodes: []
      };
    case "parallel":
      return {
        id,
        kind,
        lanes: [
          { id: uid(), nodes: [] },
          { id: uid(), nodes: [] }
        ]
      };
    case "tryCatch":
      return { id, kind, try: [], catch: [], errorName: "error" };
    case "block":
      return { id, kind, blockId, params: {} };
    default:
      return { id, kind };
  }
}

/** A copy with new ids for the node and everything inside it (paste, duplicate). */
export function withFreshIds(node: FlowNode): FlowNode {
  let copy = structuredClone(node);
  // Copied loops get new item names, and tags inside them follow.
  const renames: [string, string][] = [];
  walkFlow([copy], (n) => {
    if (n.kind === "loop" && n.mode === "forEach" && loopNameCode(n.itemName))
      renames.push([n.itemName, loopItemName(n.list)]);
  });
  if (renames.length > 0) {
    let json = JSON.stringify(copy);
    for (const [from, to] of renames) json = json.split(from).join(to);
    copy = JSON.parse(json) as FlowNode;
  }
  const visit = (n: FlowNode) => {
    n.id = uid();
    if (n.kind === "condition") n.branches.forEach((b) => (b.id = uid()));
    if (n.kind === "parallel") n.lanes.forEach((l) => (l.id = uid()));
    for (const { nodes } of slotLists(n)) nodes.forEach(visit);
  };
  visit(copy);
  return copy;
}
