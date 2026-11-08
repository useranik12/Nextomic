"use server";

import { elementQuerySchema, fillFrom, type QueryRows } from "@nextomic/schema";
import { z } from "zod";
import { authorizeProjectMember, failResult, type ActionResult } from "@/server/authorize";
import { editorExecutor, runElementQuery } from "@/server/queries/run-query";

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
