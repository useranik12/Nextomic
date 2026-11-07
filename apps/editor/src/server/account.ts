import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { getDb, user, verification } from "@nextomic/db";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { sendAuthEmail } from "@/lib/mail";
import { createRateLimiter } from "./rate-limit";

// Account changes from Settings > Profile: name, and email changes confirmed with a 6-digit code
// sent to the NEW address. Codes are stored hashed in Better Auth's verification table.

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

const CODE_TTL_MS = 10 * 60_000;
const MAX_TRIES = 5;
const SENDS = createRateLimiter(5, 10 * 60_000);

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "Names can be up to 80 characters.");
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code.");

interface PendingChange {
  email: string;
  hash: string;
  tries: number;
}

const identifier = (userId: string) => `email-change:${userId}`;
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

export async function updateName(userId: string, raw: string): Promise<void> {
  const name = nameSchema.parse(raw);
  await getDb().update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, userId));
}

/** Sends a code to `newEmail`; the email changes only after the code is confirmed. */
export async function requestEmailChange(
  current: { id: string; name: string; email: string },
  raw: string
): Promise<string> {
  const email = emailSchema.parse(raw);
  if (email === current.email.toLowerCase()) throw new AccountError("That is already your email.");
  if (!SENDS.take(current.id).ok)
    throw new AccountError("Too many codes requested. Try again in a few minutes.");
  const db = getDb();
  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, email), ne(user.id, current.id)))
    .limit(1);
  if (taken) throw new AccountError("Another account already uses that email.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const value: PendingChange = { email, hash: hashCode(code), tries: 0 };
  await db.delete(verification).where(eq(verification.identifier, identifier(current.id)));
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: identifier(current.id),
    value: JSON.stringify(value),
    expiresAt: new Date(Date.now() + CODE_TTL_MS)
  });
  await sendAuthEmail({
    kind: "email-change",
    to: email,
    vars: { name: current.name, code, newEmail: email }
  });
  return email;
}

/** Confirms the code and switches the account to the new (now verified) email. */
export async function confirmEmailChange(userId: string, raw: string): Promise<string> {
  const code = codeSchema.parse(raw);
  const db = getDb();
  const [row] = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier(userId)))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now())
    throw new AccountError("The code expired. Request a new one.");
  const pending = JSON.parse(row.value) as PendingChange;
  if (pending.tries >= MAX_TRIES)
    throw new AccountError("Too many wrong codes. Request a new one.");
  const ok = timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(pending.hash));
  if (!ok) {
    await db
      .update(verification)
      .set({
        value: JSON.stringify({ ...pending, tries: pending.tries + 1 }),
        updatedAt: new Date()
      })
      .where(eq(verification.id, row.id));
    throw new AccountError("That code is not right.");
  }
  try {
    await db
      .update(user)
      .set({ email: pending.email, emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, userId));
  } catch {
    throw new AccountError("Another account already uses that email.");
  }
  await db.delete(verification).where(eq(verification.id, row.id));
  return pending.email;
}
