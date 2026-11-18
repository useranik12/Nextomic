import type { RestConfig } from "../rest";
import { walkFlow, type TriggerFlow } from "./flow";
import type { Params } from "./fields";
import type { FlowsByNode } from "./storage";

// Action results shared with the page (owner decision 2026-11-18). An action's output is read by the
// later steps of its own flow. With "Keep result on the page" on, the run also keeps it by name
// where every element, query and flow of the page can read it as `{{ results.name }}`. The value
// lives only in the visitor's browser while the page is open: it is never stored with the project.

/** The word that opens the tag: `results.products`. */
export const RESULTS_NAMESPACE = "results";

/** Longest result a redraw carries in its request (JSON text). */
export const RESULT_LIMIT = 100_000;

/**
 * Longest result kept at all. One longer than RESULT_LIMIT is not sent with a redraw: the server
 * reads it again (only for read-only actions, see `rereadableResults`). Longer than this, or not
 * read-only, it fails its action; it is never cut short.
 */
export const RESULT_MAX = 2_000_000;

/** Most results one redraw reads again. */
export const MAX_REREADS = 10;

/** The one-line form of a result's tag. */
export const resultTag = (name: string): string => `${RESULTS_NAMESPACE}.${name}`;

/** An action output that is kept on the page. */
export interface SharedResult {
  name: string;
  /** The action node that produces it. */
  nodeId: string;
  /** Catalog action type of that node. */
  type: string;
  params: Params;
}

/**
 * Names of kept results whose action only reads (Supabase query, API Data GET call): the server can
 * run it again with the same values when a redraw needs a result too large to send. Anything that
 * writes (insert, update, delete, RPC, other methods) is never run again.
 */
export function rereadableResults(
  shared: readonly SharedResult[],
  rest: RestConfig | null
): string[] {
  return shared
    .filter((r) => {
      if (r.type === "supabase.query") return true;
      if (r.type !== "rest.call") return false;
      const id = typeof r.params.call === "string" ? r.params.call : "";
      return rest?.calls.find((c) => c.id === id)?.method === "GET";
    })
    .map((r) => r.name);
}

/**
 * The results the flows of a page keep, by name. Two actions with one name keep the later one
 * (last write wins), so the list holds each name once. Disabled flows and nodes keep nothing.
 */
export function sharedResults(flows: FlowsByNode): SharedResult[] {
  const found = new Map<string, SharedResult>();
  for (const list of Object.values(flows)) {
    for (const flow of list as TriggerFlow[]) {
      if (flow.disabled) continue;
      walkFlow(flow.nodes, (node, ancestors) => {
        if (
          node.kind !== "action" ||
          node.disabled ||
          !node.shareOutput ||
          !node.outputName ||
          ancestors.some((a) => a.disabled)
        )
          return;
        found.set(node.outputName, {
          name: node.outputName,
          nodeId: node.id,
          type: node.type,
          params: node.params
        });
      });
    }
  }
  return [...found.values()];
}
