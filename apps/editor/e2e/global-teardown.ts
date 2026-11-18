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
  await db.execute(sql`
    with gone as (select id from "user" where email like '%@example.com'),
    ws as (delete from workspaces
           where id in (select workspace_id from workspace_members where user_id in (select id from gone))
           and id not in (select workspace_id from workspace_members where user_id not in (select id from gone))
           returning id)
    delete from "user" where id in (select id from gone)`);
}
