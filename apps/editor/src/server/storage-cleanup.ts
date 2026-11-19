import { getDb } from "@nextomic/db";
import { sql } from "drizzle-orm";
import { getStorageAdapter } from "@/lib/storage";

// Folders to empty are queued in nextomic_builder.storage_deletions: by database triggers when a
// user, workspace or project row is deleted (from the app or from Studio), and by `queueFolderDeletion`
// for folders the app removes itself. Objects are removed through the Storage API; deleting
// storage.objects rows with SQL would leave the files behind (Storage refuses it).

const BATCH = 1000;
const MAX_ATTEMPTS = 20;
const ROWS_PER_RUN = 100;

async function folderObjects(bucket: string, prefix: string): Promise<string[]> {
  const result = await getDb().execute<{ name: string }>(
    sql`select name from storage.objects where bucket_id = ${bucket} and starts_with(name, ${prefix}) order by name limit ${BATCH}`
  );
  return result.rows.map((row) => row.name);
}

async function emptyFolder(bucket: string, prefix: string): Promise<void> {
  const storage = getStorageAdapter();
  // Each pass removes up to BATCH objects; stop when a pass finds none (or removes nothing).
  for (let pass = 0; pass < 10_000; pass++) {
    const names = await folderObjects(bucket, prefix);
    if (names.length === 0) return;
    await storage.deleteMany(bucket, names);
  }
  throw new Error(`Folder ${bucket}/${prefix} did not empty`);
}

/** Empties the queued folders and removes their queue rows. Returns how many folders were done. */
export async function drainStorageDeletions(): Promise<number> {
  if (process.env.STORAGE_ADAPTER === "local") return 0;
  return getDb().transaction(async (tx) => {
    const claimed = await tx.execute<{ id: number; bucket: string; prefix: string }>(
      sql`select id, bucket, prefix from nextomic_builder.storage_deletions where attempts < ${MAX_ATTEMPTS} order by id limit ${ROWS_PER_RUN} for update skip locked`
    );
    let done = 0;
    for (const row of claimed.rows) {
      try {
        await emptyFolder(row.bucket, row.prefix);
        await tx.execute(sql`delete from nextomic_builder.storage_deletions where id = ${row.id}`);
        done++;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "unknown error";
        await tx.execute(
          sql`update nextomic_builder.storage_deletions set attempts = attempts + 1, last_error = ${message} where id = ${row.id}`
        );
      }
    }
    return done;
  });
}

/** Queues a folder (it must end in a slash) and empties it now; the periodic run retries failures. */
export async function queueFolderDeletion(bucket: string, prefix: string): Promise<void> {
  if (!prefix.endsWith("/")) throw new Error("A folder path ends with a slash.");
  await getDb().execute(
    sql`insert into nextomic_builder.storage_deletions (bucket, prefix) values (${bucket}, ${prefix}) on conflict do nothing`
  );
  await drainStorageDeletions().catch(() => undefined);
}

/** Runs the drain once now and then every 20 seconds. Called once at server start. */
export function startStorageCleanup(): void {
  const run = () => void drainStorageDeletions().catch(() => undefined);
  run();
  setInterval(run, 20_000).unref();
}
