import {
  assertStoragePath,
  STORAGE_DELETE_BATCH,
  type StorageAdapter,
  type StorageLocation,
  type StoragePutInput
} from "./adapter";

export interface SupabaseStorageOptions {
  /** Supabase API origin, reachable from the server (no trailing path). */
  url: string;
  /** Secret key (service role). Server only; it bypasses Storage policies. */
  secretKey: string;
}

/** Supabase Storage through its REST API. Buckets are created by migrations, never here. */
export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly base: string;
  private readonly headers: Record<string, string>;

  constructor(options: SupabaseStorageOptions) {
    this.base = `${options.url.replace(/\/+$/, "")}/storage/v1`;
    this.headers = { apikey: options.secretKey, Authorization: `Bearer ${options.secretKey}` };
  }

  private objectUrl({ bucket, path }: StorageLocation): string {
    assertStoragePath(path);
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return `${this.base}/object/${encodeURIComponent(bucket)}/${encoded}`;
  }

  private async fail(action: string, response: Response): Promise<never> {
    const text = await response.text().catch(() => "");
    throw new Error(`Storage ${action} failed (${response.status}): ${text.slice(0, 200)}`);
  }

  async put(input: StoragePutInput): Promise<void> {
    const response = await fetch(this.objectUrl(input), {
      method: "POST",
      headers: { ...this.headers, "content-type": input.contentType, "x-upsert": "true" },
      body: Buffer.from(input.data)
    });
    if (!response.ok) await this.fail("upload", response);
  }

  async get(location: StorageLocation): Promise<Uint8Array | null> {
    const response = await fetch(this.objectUrl(location), { headers: this.headers });
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
    // Storage answers 400 (and sometimes 404) with "not_found" for a missing object.
    const text = await response.text().catch(() => "");
    if (response.status === 404 || /not.?found/i.test(text)) return null;
    throw new Error(`Storage download failed (${response.status}): ${text.slice(0, 200)}`);
  }

  async delete(location: StorageLocation): Promise<void> {
    assertStoragePath(location.path);
    await this.deleteMany(location.bucket, [location.path]);
  }

  async deleteMany(bucket: string, paths: readonly string[]): Promise<void> {
    for (let i = 0; i < paths.length; i += STORAGE_DELETE_BATCH) {
      const batch = paths.slice(i, i + STORAGE_DELETE_BATCH);
      const response = await fetch(`${this.base}/object/${encodeURIComponent(bucket)}`, {
        method: "DELETE",
        headers: { ...this.headers, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: batch })
      });
      if (!response.ok) await this.fail("delete", response);
    }
  }
}
