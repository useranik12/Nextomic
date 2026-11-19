import { getDb, workspaceMembers } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { passwordPolicyFromEnv } from "./password-policy";

/** AUTH_PASSWORD_POLICY (basic | medium | strong | very-strong), see password-policy.ts. */
export const passwordPolicy = passwordPolicyFromEnv(process.env.AUTH_PASSWORD_POLICY);

export async function getUserWorkspace(userUid: string) {
  const db = getDb();
  const [row] = await db
    .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userUid, userUid))
    .limit(1);
  return row ?? null;
}
