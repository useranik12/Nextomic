import { emailQueue, getDb, type EmailKind } from "@nextomic/db";
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { smtpFromEnv } from "./accounts";
import { smtpErrorMessage, smtpTransport } from "./transport";
import { DEFAULT_TEMPLATES, renderTemplate } from "./templates";

// The outgoing mail queue. Enqueueing renders the template and stores the message; a worker
// sends due messages with the SMTP_* account and retries failures with growing delays. Bodies are
// cleared once a message is sent or gives up, so the table keeps no content.

export const MAX_ATTEMPTS = 5;
/** Wait before attempt 2, 3, 4 and 5. */
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];
const BATCH = 10;
const STALE_SENDING_MS = 5 * 60_000;

export interface EnqueueEmail {
  kind: EmailKind;
  to: string;
  vars: Record<string, string>;
}

export function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempts, 1), RETRY_DELAYS_MS.length) - 1] ?? 30_000;
}

/** Stores a message and starts sending it. Returns the queue id. */
export async function enqueueEmail(message: EnqueueEmail): Promise<string> {
  const rendered = renderTemplate(DEFAULT_TEMPLATES[message.kind], {
    appName: "Nextomic",
    ...message.vars
  });
  const [row] = await getDb()
    .insert(emailQueue)
    .values({
      kind: message.kind,
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

async function finish(id: string, values: Partial<typeof emailQueue.$inferInsert>) {
  await getDb()
    .update(emailQueue)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(emailQueue.id, id));
}

async function deliver(message: Claimed): Promise<void> {
  const account = smtpFromEnv();
  if (!account) {
    await finish(message.id, {
      status: "failed",
      lastError: "SMTP is not configured (SMTP_HOST is empty).",
      html: null,
      text: null
    });
    return;
  }
  try {
    await smtpTransport(account).sendMail({
      from: account.from,
      to: message.toAddress,
      subject: message.subject,
      text: message.text ?? "",
      html: message.html ?? undefined
    });
    await finish(message.id, {
      status: "sent",
      sentAt: new Date(),
      lastError: null,
      html: null,
      text: null
    });
  } catch (error) {
    const lastError = smtpErrorMessage(error);
    if (message.attempts >= MAX_ATTEMPTS)
      await finish(message.id, { status: "failed", lastError, html: null, text: null });
    else
      await finish(message.id, {
        status: "queued",
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
