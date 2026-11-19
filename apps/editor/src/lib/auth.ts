import { createAuth, passwordPolicyFromEnv } from "@nextomic/auth";
import { getDb, workspaceMembers } from "@nextomic/db";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { isSmtpConfigured, sendAuthEmail } from "@/lib/mail";

// The configuration itself lives in @nextomic/auth, shared with the standalone auth service.
// The builder adds only what is its own: mail through its queue and the Next.js cookie plugin.

/** AUTH_PASSWORD_POLICY (basic | medium | strong | very-strong), see @nextomic/auth. */
export const passwordPolicy = passwordPolicyFromEnv(process.env.AUTH_PASSWORD_POLICY);

export const auth = createAuth({
  sendEmail: sendAuthEmail,
  // Verification is enforced only when SMTP is configured; otherwise a fresh deploy could never
  // register its first user. Configure SMTP_* to turn verification on.
  requireEmailVerification: isSmtpConfigured(),
  // Must stay last so it sees the cookies every other plugin sets.
  extraPlugins: [nextCookies()]
});

export async function getUserWorkspace(userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);
  return row ?? null;
}
