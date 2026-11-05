export interface StoragePutInput {
  /** Storage key, e.g. "workspaces/<id>/media/<file>". Never a raw filesystem or bucket path. */
  key: string;
  data: Uint8Array | Buffer;
  contentType: string;
}

export interface StorageAdapter {
  put(input: StoragePutInput): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** Public (or signed, for private buckets) URL a browser can load the object from. */
  getUrl(key: string): Promise<string>;
}
