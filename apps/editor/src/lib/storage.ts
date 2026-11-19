import {
  LocalStorageAdapter,
  SupabaseStorageAdapter,
  type StorageAdapter
} from "@nextomic/storage";

let adapter: StorageAdapter | undefined;

/**
 * The builder's file store. Supabase Storage in every real run (buckets: see server/storage-paths);
 * `STORAGE_ADAPTER=local` keeps files on disk for tests and offline work.
 */
export function getStorageAdapter(): StorageAdapter {
  if (adapter) return adapter;
  if (process.env.STORAGE_ADAPTER === "local") {
    adapter = new LocalStorageAdapter({
      root: process.env.STORAGE_LOCAL_ROOT ?? "./.data/storage"
    });
  } else {
    adapter = new SupabaseStorageAdapter({
      url: required("SUPABASE_URL"),
      secretKey: required("SUPABASE_SECRET_KEY")
    });
  }
  return adapter;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
