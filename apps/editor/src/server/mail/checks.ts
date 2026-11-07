import { emailQueue, getDb } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { resolveSmtpAccount, SmtpError } from "./accounts";
import { enqueueEmail, processQueue } from "./queue";
import { smtpErrorMessage, smtpTransport } from "./transport";

// "Test connection" and "Send test email" for the SMTP settings.

/** Connects and signs in to the account's server without sending anything. */
export async function verifySmtpAccount(id: string): Promise<string> {
  const account = await resolveSmtpAccount(id);
  if (!account) throw new SmtpError("SMTP account not found.");
  const started = performance.now();
  try {
    await smtpTransport(account).verify();
  } catch (error) {
    throw new SmtpError(smtpErrorMessage(error));
  }
  return `Connected to ${account.host}:${account.port} in ${Math.round(performance.now() - started)} ms.`;
}

/** Sends a test email through the queue and reports how the first attempt went. */
export async function sendTestEmail(id: string, to: string, senderName: string): Promise<string> {
  const account = await resolveSmtpAccount(id);
  if (!account) throw new SmtpError("SMTP account not found.");
  const queued = await enqueueEmail({
    kind: "test",
    to,
    accountId: id,
    vars: { name: senderName, accountName: account.name }
  });
  await processQueue();
  const [row] = await getDb()
    .select({ status: emailQueue.status, lastError: emailQueue.lastError })
    .from(emailQueue)
    .where(eq(emailQueue.id, queued))
    .limit(1);
  if (row?.status === "sent") return `Test email sent to ${to}.`;
  if (row?.status === "failed" || row?.lastError)
    throw new SmtpError(`${row.lastError ?? "Sending failed."} The queue retries automatically.`);
  return `Test email queued for ${to}.`;
}
