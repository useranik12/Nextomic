import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import {
  account,
  getDb,
  session,
  user,
  userPreferences,
  verification,
  workspaceMembers,
  workspaces
} from "@nextomic/db";
import { eq } from "drizzle-orm";
import { isSmtpConfigured, sendAuthEmail } from "@/lib/mail";

// First user on a fresh install becomes the owner of an auto-created workspace
// (see docs/platform.md "First user becomes owner on a fresh install" and the Phase 0 plan's
// workspace-model decision: one workspace per account, no multi-workspace UI yet).
async function provisionWorkspaceForNewUser(newUser: { id: string; email: string }) {
  const db = getDb();
  const isFirstUser = (await db.select().from(user).limit(2)).length <= 1;

  const [workspace] = await db.insert(workspaces).values({ name: "Your Workspace" }).returning();
  if (!workspace) throw new Error("Failed to create workspace for new user");

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: newUser.id,
    role: isFirstUser ? "owner" : "member"
  });

  await db.insert(userPreferences).values({ userId: newUser.id, colorMode: "dark" });
}

// Verification is enforced only when SMTP is configured; otherwise a fresh deploy could never
// register its first user. Configure SMTP_* to turn verification on.
const requireEmailVerification = isSmtpConfigured();

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: { user, session, account, verification }
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    sendResetPassword: async ({ user: resetUser, url }) => {
      await sendAuthEmail({ kind: "reset-password", to: resetUser.email, url });
    }
  },
  emailVerification: {
    sendVerificationEmail: async ({ user: verifyUser, url }) => {
      await sendAuthEmail({ kind: "verify-email", to: verifyUser.email, url });
    },
    sendOnSignUp: requireEmailVerification
  },
  // Admin can disable public signup (env-driven for now; a settings-table control is a later
  // phase). Better Auth has no built-in "disable signup" switch, so sign-up is gated in the
  // sign-up server action instead (see app/(auth)/sign-up/actions.ts) and this hook still runs
  // for invite-created accounts.
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          await provisionWorkspaceForNewUser(newUser);
        }
      }
    }
  },
  plugins: [nextCookies()]
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
