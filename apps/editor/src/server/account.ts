import { getDb, users } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Account changes from Settings > Profile. The name lives in public.users; the email lives in
// Supabase Auth (changes there are confirmed with a 6-digit code and copied to public.users by a
// database trigger). See server/auth/actions.ts for the email steps.

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "Names can be up to 80 characters.");

/** Saves the display name, split at the first space into first and last name. */
export async function updateName(userUid: string, raw: string): Promise<void> {
  const [firstName, ...rest] = nameSchema.parse(raw).split(/\s+/);
  await getDb()
    .update(users)
    .set({ firstName: firstName ?? null, lastName: rest.join(" ") || null, updatedOn: new Date() })
    .where(eq(users.userUid, userUid));
}
