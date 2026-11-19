import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb } from "@nextomic/db";

// Every spec signs up throwaway `@example.com` accounts. They are removed after the run, with their
// workspaces and everything under them, so tests never fill the owner's database. It only runs
// against a local database (never a deployed one) and never touches a real address.

function databaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(fileURLToPath(new URL("../../../.env", import.meta.url)), "utf8");
    return /^DATABASE_URL=(.+)$/m.exec(env)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export default async function globalTeardown(): Promise<void> {
  const url = databaseUrl();
  if (!url) return;
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return;
  process.env.DATABASE_URL = url;
  const db = getDb();
  // Separate statements: a project restricts deleting its creator, so projects and workspaces go first.
  const gone = sql`select user_uid from public.users where email like '%@example.com'`;
  await db.execute(sql`delete from nextomic_builder.projects where created_by in (${gone})`);
  await db.execute(sql`
    delete from nextomic_builder.workspaces
    where id in (select workspace_id from nextomic_builder.workspace_members where user_uid in (${gone}))
    and id not in (select workspace_id from nextomic_builder.workspace_members where user_uid not in (${gone}))`);
  // Deleting the auth account cascades to public.users, user_meta, memberships and preferences.
  await db.execute(sql`delete from auth.users where email like '%@example.com'`);
}
