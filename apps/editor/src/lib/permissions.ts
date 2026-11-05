import { getDb, projects, workspaceMembers } from "@nextomic/db";
import { and, eq } from "drizzle-orm";
import { getUserWorkspace } from "./auth";

export class AccessDeniedError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Every route/action that touches a workspace's data must call this first. */
export async function requireWorkspaceMembership(userId: string) {
  const membership = await getUserWorkspace(userId);
  if (!membership) throw new AccessDeniedError("No workspace membership found.");
  return membership;
}

/** Workspace owner/admin can manage members, billing, etc. Members can only use projects. */
export function canManageWorkspace(role: "owner" | "admin" | "member"): boolean {
  return role === "owner" || role === "admin";
}

/** Verifies the project exists AND belongs to the user's workspace before any read/write. */
export async function requireProjectAccess(userId: string, projectId: string) {
  const membership = await requireWorkspaceMembership(userId);
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, membership.workspaceId)))
    .limit(1);
  if (!project) throw new AccessDeniedError("Project not found or not in your workspace.");
  return { project, membership };
}

export async function listWorkspaceMembers(workspaceId: string) {
  const db = getDb();
  return db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
}
