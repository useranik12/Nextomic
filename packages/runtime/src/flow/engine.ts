import {
  getAction,
  groupHolds,
  isRowsField,
  rowColumns,
  MAX_LOOP_ITERATIONS,
  operandValue,
  toText,
  type ActionBlock,
  type FlowNode,
  type ParamField,
  type Params
} from "@nextomic/schema";

// Runs action flows (docs/dynamic-data-and-actions.md section 8). Pure: the page wires triggers,
// state and action handlers in; the editor's Test runs the same engine inside the canvas.

/** An action failure that catch nodes can read as { code, message }. */
export class FlowError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "FlowError";
  }
}

/** One step of a run, for the Test log. */
export interface RunLogEntry {
  nodeId: string;
  label: string;
  status: "ok" | "error";
  ms: number;
  output?: unknown;
  error?: string;
}

/** Resolved params: a lone {{ tag }} keeps its type; rows are lists of resolved cells. */
export type ResolvedParams = Record<string, unknown>;

export interface ActionContext {
  node: Extract<FlowNode, { kind: "action" }>;
  /** The element that owns the flow, or null for a page or template root. */
  elementId: string | null;
  /** The names at this node (state, loop rows, outputs), for handlers that read more. */
  scope: Readonly<Record<string, unknown>>;
  signal: AbortSignal;
}

export type ActionHandler = (params: ResolvedParams, ctx: ActionContext) => unknown;

export interface RunEnv {
  /** The live base names (app, state, page, user...); read again before every node. */
  baseScope: () => Record<string, unknown>;
  handlers: Readonly<Record<string, ActionHandler>>;
  blocks: readonly ActionBlock[];
  elementId: string | null;
  /** Extra names for this run: the trigger element's loop rows. */
  extra?: Record<string, unknown>;
  log?: (entry: RunLogEntry) => void;
  signal?: AbortSignal;
}

const BREAK = Symbol("break");
const CONTINUE = Symbol("continue");
type Jump = typeof BREAK | typeof CONTINUE | undefined;
const MAX_BLOCK_DEPTH = 20;

interface Frame {
  env: RunEnv;
  /** Names added by the run: outputs, loop items, caught errors, block params. */
  names: Record<string, unknown>;
  signal: AbortSignal;
  depth: number;
}

const scopeOf = (f: Frame) => ({ ...f.env.baseScope(), ...f.env.extra, ...f.names });

function resolveField(field: ParamField, value: unknown, scope: Record<string, unknown>) {
  if (isRowsField(field)) {
    const rows = Array.isArray(value) ? (value as Record<string, string>[]) : [];
    const columns = rowColumns(field);
    return rows.map((row) =>
      Object.fromEntries(columns.map((c) => [c.key, operandValue(row[c.key] ?? "", scope)]))
    );
  }
  const text = typeof value === "string" && value !== "" ? value : (field.default ?? "");
  return operandValue(text, scope);
}

/** Fills every field of an action from the scope. */
export function resolveParams(
  fields: readonly ParamField[],
  params: Params,
  scope: Record<string, unknown>
): ResolvedParams {
  const out: ResolvedParams = {};
  for (const field of fields) out[field.key] = resolveField(field, params[field.key], scope);
  return out;
}

/** What catch nodes read: `{ code, message }`. */
export const errorValue = (error: unknown) =>
  error instanceof FlowError
    ? { code: error.code, message: error.message }
    : { code: "error", message: error instanceof Error ? error.message : String(error) };

/** A number from a param, or the fallback when it is empty or not a number. */
export const numberParam = (value: unknown, fallback: number) => {
  const text = toText(value).trim();
  const n = typeof value === "number" ? value : Number(text);
  return text === "" || !Number.isFinite(n) ? fallback : n;
};

async function runAction(node: Extract<FlowNode, { kind: "action" }>, f: Frame) {
  const def = getAction(node.type);
  if (!def) throw new FlowError("unknown-action", `Unknown action "${node.type}".`);
  const handler = f.env.handlers[node.type];
  if (!handler) {
    throw new FlowError("not-available", `${def.label} does not run yet in this version.`);
  }
  const scope = scopeOf(f);
  const output = await handler(resolveParams(def.fields, node.params, scope), {
    node,
    elementId: f.env.elementId,
    scope,
    signal: f.signal
  });
  if (node.outputName) f.names[node.outputName] = output;
}

const textParam = (value: unknown) => (typeof value === "string" ? value : "");

async function runBlock(node: Extract<FlowNode, { kind: "block" }>, f: Frame) {
  const block = f.env.blocks.find((b) => b.id === node.blockId);
  if (!block) throw new FlowError("missing-block", "The Action Block no longer exists.");
  if (f.depth >= MAX_BLOCK_DEPTH) {
    throw new FlowError("too-deep", "Action Blocks call each other too deeply.");
  }
  const scope = scopeOf(f);
  const params = Object.fromEntries(
    block.params.map((p) => [p.name, operandValue(textParam(node.params[p.id]), scope)])
  );
  // A block sees only its parameters (and the page's base names), not the caller's outputs.
  const inner: Frame = { ...f, names: { params }, depth: f.depth + 1 };
  await runList(block.nodes, inner);
  const output = block.returns ? operandValue(block.returns.value, scopeOf(inner)) : undefined;
  if (node.outputName) f.names[node.outputName] = output;
}

async function runLoop(node: Extract<FlowNode, { kind: "loop" }>, f: Frame): Promise<void> {
  const cap = Math.min(node.maxIterations, MAX_LOOP_ITERATIONS);
  if (node.mode === "while") {
    for (let round = 0; round < cap; round += 1) {
      const scope = scopeOf(f);
      if (!node.condition || !groupHolds(node.condition, (t) => operandValue(t, scope))) return;
      if ((await runList(node.nodes, f)) === BREAK) return;
    }
    return;
  }
  const scope = scopeOf(f);
  const list = operandValue(node.list, scope);
  if (!Array.isArray(list)) throw new FlowError("not-a-list", "The loop's list is not a list.");
  const step = Math.trunc(numberParam(operandValue(node.step, scope), 1));
  if (step === 0) throw new FlowError("bad-step", "The loop's step size cannot be 0.");
  const last = list.length - 1;
  const start = Math.trunc(numberParam(operandValue(node.start, scope), step > 0 ? 0 : last));
  const end = Math.trunc(numberParam(operandValue(node.end, scope), step > 0 ? last : 0));
  let rounds = 0;
  for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
    if (i < 0 || i > last) continue;
    if (rounds >= cap) return;
    rounds += 1;
    f.names[node.itemName] = { item: list[i], index: i };
    if ((await runList(node.nodes, f)) === BREAK) return;
  }
}

async function runNode(node: FlowNode, f: Frame): Promise<Jump> {
  if (f.signal.aborted) throw new FlowError("aborted", "The run was stopped.");
  switch (node.kind) {
    case "action":
      await runAction(node, f);
      return undefined;
    case "block":
      await runBlock(node, f);
      return undefined;
    case "condition": {
      const scope = scopeOf(f);
      const read = (t: string) => operandValue(t, scope);
      const branch = node.branches.find((b) => groupHolds(b.group, read));
      return runList(branch ? branch.nodes : (node.else ?? []), f);
    }
    case "loop":
      await runLoop(node, f);
      return undefined;
    case "break":
      return BREAK;
    case "continue":
      return CONTINUE;
    case "parallel":
      // Lanes share outputs; break and continue never cross a lane.
      await Promise.all(node.lanes.map((lane) => runList(lane.nodes, f)));
      return undefined;
    case "tryCatch":
      try {
        return await runList(node.try, f);
      } catch (error) {
        if (f.signal.aborted) throw error;
        f.names[node.errorName] = errorValue(error);
        return runList(node.catch, f);
      }
  }
}

const labelOf = (node: FlowNode) =>
  node.name || (node.kind === "action" ? (getAction(node.type)?.label ?? node.type) : node.kind);

async function runList(nodes: readonly FlowNode[], f: Frame): Promise<Jump> {
  for (const node of nodes) {
    if (node.disabled) continue;
    const started = Date.now();
    try {
      const jump = await runNode(node, f);
      const output =
        (node.kind === "action" || node.kind === "block") && node.outputName
          ? f.names[node.outputName]
          : undefined;
      f.env.log?.({
        nodeId: node.id,
        label: labelOf(node),
        status: "ok",
        ms: Date.now() - started,
        output
      });
      if (jump) return jump;
    } catch (error) {
      f.env.log?.({
        nodeId: node.id,
        label: labelOf(node),
        status: "error",
        ms: Date.now() - started,
        error: errorValue(error).message
      });
      throw error;
    }
  }
  return undefined;
}

/** Runs a node list (a trigger flow, or one node for "Test node"); rejects with an uncaught error. */
export async function runFlow(nodes: readonly FlowNode[], env: RunEnv): Promise<void> {
  const signal = env.signal ?? new AbortController().signal;
  await runList(nodes, { env, names: {}, signal, depth: 0 });
}
