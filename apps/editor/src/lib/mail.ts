import { hasSmtpAccount } from "@/server/mail/accounts";
import { enqueueEmail } from "@/server/mail/queue";

// Platform email for Better Auth. Messages go through the mail queue with the default SMTP
// account (a saved default, else the SMTP_* environment account); see server/mail/*.

/**
 * Email verification is enforced only when mail can be delivered. Better Auth reads this once at
 * start, so it follows the SMTP_* variables; a saved account added later takes effect for
 * verification after the next restart (sending works immediately).
 */
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
  if (!(await hasSmtpAccount())) {
    if (process.env.DEV_EMAIL_TO_CONSOLE === "true") {
      // eslint-disable-next-line no-console
      console.log(`[auth email:${kind}] to=${to} url=${url}`);
      return;
    }
    throw new Error("No SMTP account is set up. Add one in Settings or set the SMTP_* variables.");
  }
  await enqueueEmail({ kind, to, vars: { name, email: to, url } });
}
