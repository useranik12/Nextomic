import { passkey } from "@better-auth/passkey";
import {
  account,
  getDb,
  passkey as passkeyTable,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
  type EmailKind
} from "@nextomic/db";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP, magicLink, twoFactor } from "better-auth/plugins";
import { authBaseUrl, authTrustedOrigins } from "./auth-url";
import { MAX_PASSWORD_LENGTH, passwordPolicyFromEnv, passwordProblem } from "./password-policy";
import { ensureWorkspaceForUser } from "./workspace";

// The one Better Auth configuration of the platform. The builder (apps/editor) and the standalone
// auth service (apps/auth-studio) both build their instance here, so ids, the password policy, the
// plugins and the workspace each new account gets are identical in both. Only what differs is
// passed in: how email is sent and any extra plugins (the builder adds its Next.js cookie plugin).

export interface AuthEmail {
  kind: EmailKind;
  to: string;
  /** Template values: name, url, code, purpose, newEmail as the kind needs. */
  vars: Record<string, string>;
}

export type AuthEmailSender = (email: AuthEmail) => Promise<void>;

export interface CreateAuthOptions {
  sendEmail: AuthEmailSender;
  /** Enforced only when mail can be sent, otherwise a fresh deploy could never register. */
  requireEmailVerification: boolean;
  /** Appended after the shared plugins. A plugin that must run last (Next.js cookies) goes here. */
  extraPlugins?: BetterAuthPlugin[];
}

/** Endpoints that set a password, and the body field holding it. */
const PASSWORD_FIELDS: Record<string, string> = {
  "/sign-up/email": "password",
  "/reset-password": "newPassword",
  "/change-password": "newPassword",
  "/email-otp/reset-password": "password"
};

const OTP_PURPOSE: Record<
  "sign-in" | "email-verification" | "forget-password" | "change-email",
  string
> = {
  "sign-in": "sign in",
  "change-email": "change your email",
  "email-verification": "verify your email",
  "forget-password": "change your password"
};

export function createAuth({
  sendEmail,
  requireEmailVerification,
  extraPlugins = []
}: CreateAuthOptions) {
  const baseURL = authBaseUrl();
  /** AUTH_PASSWORD_POLICY (basic | medium | strong | very-strong), see password-policy.ts. */
  const passwordPolicy = passwordPolicyFromEnv(process.env.AUTH_PASSWORD_POLICY);

  return betterAuth({
    // Set explicitly so links and the origin check always use the public address, never the
    // container's internal one (behind Traefik the app itself sees http://localhost:3000).
    baseURL,
    trustedOrigins: authTrustedOrigins(),
    // Row ids are native uuids (Supabase style); the database makes them with gen_random_uuid().
    advanced: { database: { generateId: "uuid" } },
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
        await sendEmail({
          kind: "reset-password",
          to: resetUser.email,
          vars: { name: resetUser.name, url }
        });
      }
    },
    emailVerification: {
      sendVerificationEmail: async ({ user: verifyUser, url }) => {
        await sendEmail({
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
            await ensureWorkspaceForUser(newUser.id);
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
          await sendEmail({ kind: "magic-link", to: email, vars: { url } });
        }
      }),
      // Codes by email; the profile page uses them to change the password.
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendEmail({
            kind: "otp-code",
            to: email,
            vars: { code: otp, purpose: OTP_PURPOSE[type] }
          });
        }
      }),
      ...extraPlugins
    ]
  });
}
