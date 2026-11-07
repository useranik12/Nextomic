import { smtpFromEnv } from "@/server/mail/accounts";
import { enqueueEmail } from "@/server/mail/queue";

// Platform email for Better Auth. Messages go through the mail queue and are sent with the
// SMTP_* variables (Docker Compose / Dokploy); see server/mail/*.

/** Email verification is enforced only when SMTP is configured, so a fresh deploy can register. */
export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export interface AuthEmail {
  kind: "verify-email" | "reset-password";
  to: string;
  name: string;
  url: string;
}

export async function sendAuthEmail({ kind, to, name, url }: AuthEmail): Promise<void> {
  if (!smtpFromEnv()) {
    if (process.env.DEV_EMAIL_TO_CONSOLE === "true") {
      // eslint-disable-next-line no-console
      console.log(`[auth email:${kind}] to=${to} url=${url}`);
      return;
    }
    throw new Error("SMTP is not configured. Set the SMTP_* variables.");
  }
  await enqueueEmail({ kind, to, vars: { name, email: to, url } });
}
