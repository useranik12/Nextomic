import { countConditions } from "../condition";
import { IDENTIFIER_PATTERN, type TypeSpec } from "../state";
import type { ActionBlock } from "./blocks";
import { actionDisabledReason, getAction, outputIsList } from "./catalog";
import {
  incompleteRows,
  invalidOptions,
  missingRequired,
  type ParamField,
  type Params
} from "./fields";
import {
  childLists,
  countNodes,
  flowDepth,
  MAX_FLOW_DEPTH,
  MAX_FLOW_NODES,
  type FlowNode,
  type TriggerFlow
} from "./flow";
import { getTrigger, triggerProblem, type FlowOwner } from "./triggers";

// Problems listed by the issues badge of the flow editor. Errors block publishing; warnings do not.
// Disabled nodes are skipped when the flow runs, so they are not checked.

export interface FlowIssue {
  /** The node with the problem; null for the trigger itself. */
  nodeId: string | null;
  message: string;
  severity: "error" | "warning";
}

export interface FlowCheckContext {
  owner: FlowOwner;
  elementType: string;
  blocks: readonly ActionBlock[];
}

const error = (nodeId: string | null, message: string): FlowIssue => ({
  nodeId,
  message,
  severity: "error"
});
const warning = (nodeId: string | null, message: string): FlowIssue => ({
  nodeId,
  message,
  severity: "warning"
});

function fieldIssues(nodeId: string | null, fields: readonly ParamField[], params: Params) {
  return [
    ...missingRequired(fields, params).map((label) => error(nodeId, `${label} is required.`)),
    ...incompleteRows(fields, params).map((where) => error(nodeId, `${where} is required.`)),
    ...invalidOptions(fields, params).map((label) =>
      error(nodeId, `${label} has an unknown value.`)
    )
  ];
}

function actionIssues(node: Extract<FlowNode, { kind: "action" }>): FlowIssue[] {
  if (node.type === "") return [error(node.id, "Not defined: choose an action.")];
  const action = getAction(node.type);
  if (!action) return [error(node.id, `Unknown action "${node.type}".`)];
  const reason = actionDisabledReason(action);
  if (reason) return [error(node.id, `${action.label} is not available yet. ${reason}`)];
  const issues = fieldIssues(node.id, action.fields, node.params);
  if (node.outputName && !action.output) {
    issues.push(warning(node.id, `${action.label} returns nothing; the output name is not used.`));
  }
  return issues;
}

function blockIssues(
  node: Extract<FlowNode, { kind: "block" }>,
  blocks: readonly ActionBlock[]
): FlowIssue[] {
  const block = blocks.find((b) => b.id === node.blockId);
  if (!block) return [error(node.id, "The Action Block no longer exists.")];
  const issues = block.params
    .filter((p) => p.required && (node.params[p.id] ?? "") === "")
    .map((p) => error(node.id, `${block.name}: ${p.name} is required.`));
  if (node.outputName && !block.returns) {
    issues.push(warning(node.id, `${block.name} returns nothing; the output name is not used.`));
  }
  return issues;
}

/** Break and continue need a loop around them, with no parallel lane in between. */
function insideLoop(ancestors: readonly FlowNode[]): boolean {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const kind = ancestors[i]?.kind;
    if (kind === "loop") return true;
    if (kind === "parallel") return false;
  }
  return false;
}

function nodeIssues(
  node: FlowNode,
  ancestors: readonly FlowNode[],
  blocks: readonly ActionBlock[]
): FlowIssue[] {
  switch (node.kind) {
    case "action":
      return actionIssues(node);
    case "block":
      return blockIssues(node, blocks);
    case "condition":
      return node.branches
        .filter((b) => countConditions(b.group) === 0)
        .map(() => error(node.id, "Every branch needs at least one condition."));
    case "loop":
      if (node.mode === "forEach" && node.list.trim() === "") {
        return [error(node.id, "Choose the list to loop over.")];
      }
      if (node.mode === "while" && (!node.condition || countConditions(node.condition) === 0)) {
        return [error(node.id, "Add the condition the loop repeats while.")];
      }
      return [];
    case "break":
    case "continue":
      return insideLoop(ancestors)
        ? []
        : [
            error(
              node.id,
              `${node.kind === "break" ? "Break" : "Continue"} works only inside a loop.`
            )
          ];
    case "parallel":
      return node.lanes.length < 2 ? [warning(node.id, "A parallel action needs two lanes.")] : [];
    case "tryCatch":
      return node.try.length === 0 ? [warning(node.id, "The try part is empty.")] : [];
  }
}

/** The names a node declares: its output, a loop item, a caught error. */
function declaredNames(node: FlowNode): string[] {
  if (node.kind === "action" || node.kind === "block")
    return node.outputName ? [node.outputName] : [];
  if (node.kind === "loop" && node.mode === "forEach") return [node.itemName];
  if (node.kind === "tryCatch") return [node.errorName];
  return [];
}

function nameIssues(nodes: readonly FlowNode[]): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const seen = new Set<string>();
  const visit = (list: readonly FlowNode[]) => {
    for (const node of list) {
      if (node.disabled) continue;
      for (const name of declaredNames(node)) {
        if (!IDENTIFIER_PATTERN.test(name)) {
          issues.push(error(node.id, `"${name}" is not a valid name: use letters, digits and _.`));
        } else if (seen.has(name)) {
          issues.push(error(node.id, `The name "${name}" is already used in this flow.`));
        }
        seen.add(name);
      }
      childLists(node).forEach(visit);
    }
  };
  visit(nodes);
  return issues;
}

/** Problems of a node list (a trigger flow or an Action Block). */
export function nodesIssues(
  nodes: readonly FlowNode[],
  blocks: readonly ActionBlock[]
): FlowIssue[] {
  if (countNodes(nodes) > MAX_FLOW_NODES) {
    return [error(null, `A flow can have at most ${MAX_FLOW_NODES} nodes.`)];
  }
  if (flowDepth(nodes) > MAX_FLOW_DEPTH) {
    return [error(null, `Nodes can be nested at most ${MAX_FLOW_DEPTH} levels deep.`)];
  }
  const issues: FlowIssue[] = [];
  const visit = (list: readonly FlowNode[], ancestors: readonly FlowNode[]) => {
    for (const node of list) {
      if (node.disabled) continue;
      issues.push(...nodeIssues(node, ancestors, blocks));
      for (const child of childLists(node)) visit(child, [...ancestors, node]);
    }
  };
  visit(nodes, []);
  return [...issues, ...nameIssues(nodes)];
}

/** Problems of one trigger flow; a disabled flow has none. */
export function flowIssues(flow: TriggerFlow, ctx: FlowCheckContext): FlowIssue[] {
  if (flow.disabled) return [];
  const problem = triggerProblem(flow.trigger, ctx.owner, ctx.elementType);
  if (problem) return [error(null, problem)];
  const trigger = getTrigger(flow.trigger);
  return [
    ...fieldIssues(null, trigger?.fields ?? [], flow.settings),
    ...nodesIssues(flow.nodes, ctx.blocks)
  ];
}

export interface VisibleName {
  name: string;
  /** The node that declares it. */
  nodeId: string;
  source: "output" | "item" | "error";
}

const outputsOf = (node: FlowNode): VisibleName[] =>
  (node.kind === "action" || node.kind === "block") && node.outputName && !node.disabled
    ? [{ name: node.outputName, nodeId: node.id, source: "output" }]
    : [];

/** Names a finished node leaves for the nodes after it (parallel lanes all finish first). */
function namesAfter(node: FlowNode): VisibleName[] {
  if (node.kind === "parallel" && !node.disabled) {
    return node.lanes.flatMap((lane) => lane.nodes.flatMap(outputsOf));
  }
  return outputsOf(node);
}

/** Names visible inside one child list of a node (a loop item, a caught error). */
function namesInside(node: FlowNode, list: readonly FlowNode[]): VisibleName[] {
  if (node.kind === "loop" && node.mode === "forEach") {
    return [{ name: node.itemName, nodeId: node.id, source: "item" }];
  }
  if (node.kind === "tryCatch" && list === node.catch) {
    return [{ name: node.errorName, nodeId: node.id, source: "error" }];
  }
  return [];
}

/**
 * Names a node can read: outputs of the nodes that surely ran before it (earlier nodes of its own
 * list and of every list around it), plus loop items and caught errors around it. Outputs inside
 * an earlier condition, loop or try are not visible after it: those nodes may not have run.
 * Returns null when the node is not in the list.
 */
export function visibleNames(
  nodes: readonly FlowNode[],
  nodeId: string,
  before: readonly VisibleName[] = []
): VisibleName[] | null {
  let names = [...before];
  for (const node of nodes) {
    if (node.id === nodeId) return names;
    for (const list of childLists(node)) {
      const found = visibleNames(list, nodeId, [...names, ...namesInside(node, list)]);
      if (found) return found;
    }
    names = [...names, ...namesAfter(node)];
  }
  return null;
}

/** The type of what a node returns, or null when it returns nothing. */
export function nodeOutputType(node: FlowNode, blocks: readonly ActionBlock[]): TypeSpec | null {
  if (node.kind === "action") {
    const output = getAction(node.type)?.output;
    if (!output) return null;
    const ref = output.refParam ? node.params[output.refParam] : "";
    return {
      type: output.type,
      isList: outputIsList(output, node.params),
      ref: typeof ref === "string" ? ref : ""
    };
  }
  if (node.kind === "block") {
    const returns = blocks.find((b) => b.id === node.blockId)?.returns;
    return returns ? { type: returns.type, isList: returns.isList, ref: returns.ref } : null;
  }
  return null;
}
