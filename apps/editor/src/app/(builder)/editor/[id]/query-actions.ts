"use server";

import {
  elementQuerySchema,
  fillFrom,
  type QueryRows,
  type RestConfig,
  type SupabaseStructure
} from "@nextomic/schema";
import { z } from "zod";
import { authorizeProjectMember, failResult, type ActionResult } from "@/server/authorize";
import { editorExecutor, querySources, runElementQuery } from "@/server/queries/run-query";

// Runs a query loop for the editor canvas. The canvas resolves the {{ }} templates with its own
// preview values and sends the filled text; the rows come back and stay in the browser's memory.

const inputSchema = z.object({
  query: elementQuerySchema,
  resolved: z.record(z.string().max(10_000), z.string().max(10_000)).default({}),
  offset: z.number().int().min(0).max(1_000_000).default(0)
});

export async function runQueryAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<QueryRows>> {
  try {
    const { userId, workspaceId } = await authorizeProjectMember(projectId);
    const { query, resolved, offset } = inputSchema.parse(input);
    const rows = await runElementQuery({
      projectId,
      query,
      fill: fillFrom(resolved),
      offset,
      execute: editorExecutor({ userId, workspaceId, projectId })
    });
    return { data: rows, error: null };
  } catch (error) {
    return failResult(error, "The query could not run.");
  }
}

export interface QuerySourcesSnapshot {
  /** Null when Supabase is not connected; `active` false when it is turned off. */
  supabase: { active: boolean; structure: SupabaseStructure | null } | null;
  /** API Data groups and calls (definitions only; auth values never leave the server). */
  rest: RestConfig;
}

/** What the Query Loop panel can choose from: the saved Supabase structure and API Data calls. */
export async function getQuerySourcesAction(
  projectId: string
): Promise<ActionResult<QuerySourcesSnapshot>> {
  try {
    await authorizeProjectMember(projectId);
    return { data: await querySources(projectId), error: null };
  } catch (error) {
    return failResult(error, "Could not load the query sources.");
  }
}
