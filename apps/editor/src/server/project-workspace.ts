import { eq } from "drizzle-orm";
import { getDb, projects } from "@nextomic/db";

// A project never moves to another workspace, so the answer is safe to keep.
const known = new Map<string, string>();

/** The workspace a project belongs to; storage paths start with it. */
export async function workspaceIdOf(projectId: string): Promise<string> {
  const cached = known.get(projectId);
  if (cached) return cached;
  const [row] = await getDb()
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row) throw new Error("That project no longer exists.");
  known.set(projectId, row.workspaceId);
  return row.workspaceId;
}
