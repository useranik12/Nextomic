import { getDb, user, userPreferences, workspaceMembers, workspaces } from "@nextomic/db";
import { eq, sql } from "drizzle-orm";

export interface WorkspaceMembership {
  workspaceId: string;
  role: "owner" | "admin" | "member";
}

/**
 * The workspace an account belongs to, creating it when the account has none. An account made by
 * Better Auth gets one at once (the user-created hook); an account made another way (the auth
 * dashboard creates rows directly, without hooks) gets it on first use. Safe to call twice at the
 * same time: a per-user advisory lock makes the second caller find the first one's workspace.
 *
 * First user on a fresh install becomes the owner (docs/platform.md "First user becomes owner on
 * a fresh install"); one workspace per account, no multi-workspace UI yet.
 */
export async function ensureWorkspaceForUser(userId: string): Promise<WorkspaceMembership> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [existing] = await tx
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))
      .limit(1);
    if (existing) return existing;

    const isFirstUser = (await tx.select({ id: user.id }).from(user).limit(2)).length <= 1;
    const [workspace] = await tx.insert(workspaces).values({ name: "Your Workspace" }).returning();
    if (!workspace) throw new Error("Failed to create workspace for new user");
    const role = isFirstUser ? "owner" : "member";
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role });
    await tx.insert(userPreferences).values({ userId, colorMode: "dark" }).onConflictDoNothing();
    return { workspaceId: workspace.id, role };
  });
}
