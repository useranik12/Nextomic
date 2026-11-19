import { getDb, userPreferences, users, workspaceMembers, workspaces } from "@nextomic/db";
import { eq, sql } from "drizzle-orm";

export interface WorkspaceMembership {
  workspaceId: string;
  role: "owner" | "editor" | "member" | "viewer";
}

/**
 * The workspace an account belongs to, creating it when the account has none. Called on first use,
 * so it works for an account made in the Supabase dashboard as well as one made on the sign-up
 * page. Safe to call twice at the same time: a per-user advisory lock makes the second caller find
 * the first one's workspace.
 *
 * The first account on a fresh install becomes the owner (docs/platform.md); everyone after joins
 * as a member of a workspace of their own. One workspace per account, no multi-workspace UI yet.
 */
export async function ensureWorkspaceForUser(userUid: string): Promise<WorkspaceMembership> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userUid}))`);

    const [existing] = await tx
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userUid, userUid))
      .limit(1);
    if (existing) return existing;

    const isFirstUser = (await tx.select({ id: users.userId }).from(users).limit(2)).length <= 1;
    const [workspace] = await tx.insert(workspaces).values({ name: "Your Workspace" }).returning();
    if (!workspace) throw new Error("Failed to create workspace for new user");
    const role = isFirstUser ? "owner" : "member";
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userUid, role });
    await tx.insert(userPreferences).values({ userUid, colorMode: "dark" }).onConflictDoNothing();
    return { workspaceId: workspace.id, role };
  });
}
