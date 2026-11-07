import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink, twoFactor } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import {
  account,
  getDb,
  passkey as passkeyTable,
  session,
  twoFactor as twoFactorTable,
  user,
  userPreferences,
  verification,
  workspaceMembers,
  workspaces
} from "@nextomic/db";
import { eq } from "drizzle-orm";
import { authBaseUrl, authTrustedOrigins } from "@/lib/auth-url";
import { isSmtpConfigured, sendAuthEmail } from "@/lib/mail";
import { MAX_PASSWORD_LENGTH, passwordPolicyFromEnv, passwordProblem } from "@/lib/password-policy";

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

/** AUTH_PASSWORD_POLICY (basic | medium | strong | very-strong), see lib/password-policy.ts. */
export const passwordPolicy = passwordPolicyFromEnv(process.env.AUTH_PASSWORD_POLICY);

/** Endpoints that set a password, and the body field holding it. */
const PASSWORD_FIELDS: Record<string, string> = {
  "/sign-up/email": "password",
  "/reset-password": "newPassword",
  "/change-password": "newPassword",
  "/email-otp/reset-password": "password"
};

const OTP_PURPOSE: Record<"sign-in" | "email-verification" | "forget-password", string> = {
  "sign-in": "sign in",
  "email-verification": "verify your email",
  "forget-password": "change your password"
};

const baseURL = authBaseUrl();

export const auth = betterAuth({
  // Set explicitly so links and the origin check always use the public address, never the
  // container's internal one (behind Traefik the app itself sees http://localhost:3000).
  baseURL,
  trustedOrigins: authTrustedOrigins(),
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      passkey: passkeyTable,
      twoFactor: twoFactorTable
    }
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    minPasswordLength: passwordPolicy.minLength,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    sendResetPassword: async ({ user: resetUser, url }) => {
      await sendAuthEmail({
        kind: "reset-password",
        to: resetUser.email,
        vars: { name: resetUser.name, url }
      });
    }
  },
  emailVerification: {
    sendVerificationEmail: async ({ user: verifyUser, url }) => {
      await sendAuthEmail({
        kind: "verify-email",
        to: verifyUser.email,
        vars: { name: verifyUser.name, url }
      });
    },
    sendOnSignUp: requireEmailVerification
  },
  hooks: {
    // The password policy applies wherever a password is set.
    before: createAuthMiddleware(async (ctx) => {
      const field = PASSWORD_FIELDS[ctx.path];
      if (!field) return;
      const value = (ctx.body as Record<string, unknown> | undefined)?.[field];
      if (typeof value !== "string") return;
      const problem = passwordProblem(value, passwordPolicy);
      if (problem) throw new APIError("BAD_REQUEST", { message: problem });
    })
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
  plugins: [
    twoFactor({ issuer: "Nextomic" }),
    passkey({
      rpName: "Nextomic",
      rpID: baseURL ? new URL(baseURL).hostname : "localhost",
      origin: baseURL ?? null
    }),
    // Sign-in links only for existing accounts; new accounts go through the sign-up page.
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        await sendAuthEmail({ kind: "magic-link", to: email, vars: { url } });
      }
    }),
    // Codes by email; the profile page uses them to change the password.
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      disableSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendAuthEmail({
          kind: "otp-code",
          to: email,
          vars: { code: otp, purpose: OTP_PURPOSE[type] }
        });
      }
    }),
    nextCookies()
  ]
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
