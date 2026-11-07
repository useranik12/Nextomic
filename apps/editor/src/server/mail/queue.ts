import { emailQueue, getDb, type EmailKind } from "@nextomic/db";
import { and, asc, count, desc, eq, gt, inArray, lt, lte, sql } from "drizzle-orm";
import { resolveSmtpAccount } from "./accounts";
import { smtpErrorMessage, smtpTransport } from "./transport";
import { getEmailTemplate, renderTemplate } from "./templates";

// The outgoing mail queue. Enqueueing renders the template and stores the message; a worker
// sends due messages, retries failures with growing delays and respects each account's rate
// limit. Bodies are cleared once a message is sent or gives up, so the log keeps no content.

export const MAX_ATTEMPTS = 5;
/** Wait before attempt 2, 3, 4 and 5. */
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];
const BATCH = 10;
const STALE_SENDING_MS = 5 * 60_000;

export interface EnqueueEmail {
  kind: EmailKind;
  to: string;
  vars: Record<string, string>;
  /** An account id, "env", or null for the default account. */
  accountId?: string | null;
}

export function retryDelay(attempts: number): number {
  return (
    RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1] ?? RETRY_DELAYS_MS[0] ?? 30_000
  );
}

/** Stores a message and starts sending it. Returns the queue id. */
export async function enqueueEmail(message: EnqueueEmail): Promise<string> {
  const template = await getEmailTemplate(message.kind);
  const rendered = renderTemplate(template, { appName: "Nextomic", ...message.vars });
  const [row] = await getDb()
    .insert(emailQueue)
    .values({
      kind: message.kind,
      accountId: message.accountId ?? null,
      toAddress: message.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      status: "queued"
    })
    .returning({ id: emailQueue.id });
  if (!row) throw new Error("Could not queue the email.");
  kickQueue();
  return row.id;
}

type Claimed = typeof emailQueue.$inferSelect;

async function claimDue(): Promise<Claimed[]> {
  const db = getDb();
  const now = new Date();
  // A worker that died mid-send leaves rows in "sending"; give them back to the queue.
  await db
    .update(emailQueue)
    .set({ status: "queued", updatedAt: now })
    .where(
      and(
        eq(emailQueue.status, "sending"),
        lt(emailQueue.updatedAt, new Date(now.getTime() - STALE_SENDING_MS))
      )
    );
  const due = db
    .select({ id: emailQueue.id })
    .from(emailQueue)
    .where(and(eq(emailQueue.status, "queued"), lte(emailQueue.nextAttemptAt, now)))
    .orderBy(asc(emailQueue.createdAt))
    .limit(BATCH)
    .for("update", { skipLocked: true });
  return db
    .update(emailQueue)
    .set({ status: "sending", attempts: sql`${emailQueue.attempts} + 1`, updatedAt: now })
    .where(inArray(emailQueue.id, due))
    .returning();
}

async function sentInLastMinute(accountId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(emailQueue)
    .where(
      and(eq(emailQueue.sentWith, accountId), gt(emailQueue.sentAt, new Date(Date.now() - 60_000)))
    );
  return row?.n ?? 0;
}

async function finish(id: string, values: Partial<typeof emailQueue.$inferInsert>) {
  await getDb()
    .update(emailQueue)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(emailQueue.id, id));
}

async function deliver(message: Claimed): Promise<void> {
  const account = await resolveSmtpAccount(message.accountId);
  if (!account) {
    await finish(message.id, {
      status: "failed",
      lastError: "No SMTP account is set up.",
      html: null,
      text: null
    });
    return;
  }
  if (
    account.rateLimitPerMinute !== null &&
    (await sentInLastMinute(account.id)) >= account.rateLimitPerMinute
  ) {
    // Over the account's limit: wait, without spending an attempt.
    await finish(message.id, {
      status: "queued",
      attempts: Math.max(message.attempts - 1, 0),
      nextAttemptAt: new Date(Date.now() + 15_000)
    });
    return;
  }
  try {
    await smtpTransport(account).sendMail({
      from: account.from,
      to: message.toAddress,
      replyTo: account.replyTo ?? undefined,
      subject: message.subject,
      text: message.text ?? "",
      html: message.html ?? undefined
    });
    await finish(message.id, {
      status: "sent",
      sentWith: account.id,
      sentAt: new Date(),
      lastError: null,
      html: null,
      text: null
    });
  } catch (error) {
    const lastError = smtpErrorMessage(error);
    if (message.attempts >= MAX_ATTEMPTS)
      await finish(message.id, {
        status: "failed",
        sentWith: account.id,
        lastError,
        html: null,
        text: null
      });
    else
      await finish(message.id, {
        status: "queued",
        sentWith: account.id,
        lastError,
        nextAttemptAt: new Date(Date.now() + retryDelay(message.attempts))
      });
  }
}

let running: Promise<void> | null = null;

/** Sends every due message. Concurrent calls share one run. */
export function processQueue(): Promise<void> {
  running ??= (async () => {
    try {
      for (let batch = await claimDue(); batch.length > 0; batch = await claimDue())
        await Promise.all(batch.map(deliver));
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Starts a send in the background; failures stay in the queue for the next run. */
export function kickQueue() {
  processQueue().catch(() => {
    // The rows keep their state; the worker tries again on its next tick.
  });
}

export interface EmailLogEntry {
  id: string;
  kind: EmailKind;
  to: string;
  subject: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  sentWith: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

/** The latest messages, newest first, without bodies. */
export async function recentEmails(limit = 50): Promise<EmailLogEntry[]> {
  const rows = await getDb()
    .select({
      id: emailQueue.id,
      kind: emailQueue.kind,
      to: emailQueue.toAddress,
      subject: emailQueue.subject,
      status: emailQueue.status,
      attempts: emailQueue.attempts,
      sentWith: emailQueue.sentWith,
      lastError: emailQueue.lastError,
      createdAt: emailQueue.createdAt,
      sentAt: emailQueue.sentAt
    })
    .from(emailQueue)
    .orderBy(desc(emailQueue.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null
  }));
}
