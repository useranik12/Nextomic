/** Where an object lives: a Supabase Storage bucket and a path inside it. */
export interface StorageLocation {
  bucket: string;
  /** Slash-separated path inside the bucket, e.g. "<workspace>/<project>/media-assets/<id>/original". */
  path: string;
}

export interface StoragePutInput extends StorageLocation {
  data: Uint8Array | Buffer;
  contentType: string;
}

export interface StorageAdapter {
  put(input: StoragePutInput): Promise<void>;
  /** The object's bytes, or null when it does not exist. */
  get(location: StorageLocation): Promise<Uint8Array | null>;
  /** Removes one object. A missing object is not an error. */
  delete(location: StorageLocation): Promise<void>;
  /** Removes many objects of one bucket, in batches. */
  deleteMany(bucket: string, paths: readonly string[]): Promise<void>;
}

export const STORAGE_DELETE_BATCH = 1000;

/** Rejects paths that could escape their bucket or hide from folder-based cleanup. */
export function assertStoragePath(path: string): void {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  )
    throw new Error(`Invalid storage path: ${path}`);
}
