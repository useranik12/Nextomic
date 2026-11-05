import { LocalStorageAdapter, S3StorageAdapter, type StorageAdapter } from "@nextomic/storage";

let adapter: StorageAdapter | undefined;

export function getStorageAdapter(): StorageAdapter {
  if (adapter) return adapter;

  const kind = process.env.STORAGE_ADAPTER ?? "local";
  if (kind === "s3") {
    adapter = new S3StorageAdapter({
      bucket: required("STORAGE_S3_BUCKET"),
      region: required("STORAGE_S3_REGION"),
      endpoint: process.env.STORAGE_S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.STORAGE_S3_ENDPOINT),
      publicBaseUrl: required("STORAGE_PUBLIC_BASE_URL"),
      credentials:
        process.env.STORAGE_S3_ACCESS_KEY_ID && process.env.STORAGE_S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY
            }
          : undefined
    });
  } else {
    adapter = new LocalStorageAdapter({
      root: process.env.STORAGE_LOCAL_ROOT ?? "./.data/storage",
      publicBaseUrl: required("STORAGE_PUBLIC_BASE_URL")
    });
  }
  return adapter;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
