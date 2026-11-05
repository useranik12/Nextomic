import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";

import { db, schema } from "db";

import { getEnvironment } from "./env";
import { sendPlatformEmail } from "./platform-mail";

const environment = getEnvironment();

export const auth = betterAuth({
  baseURL: environment.BETTER_AUTH_URL,
  secret: environment.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendPlatformEmail({
        to: user.email,
        subject: "Reset your Nextomic password",
        text: `Reset your password: ${url}`
      });
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendPlatformEmail({
        to: user.email,
        subject: "Verify your Nextomic email",
        text: `Verify your email: ${url}`
      });
    }
  },
  advanced: { database: { joins: true } }
});
