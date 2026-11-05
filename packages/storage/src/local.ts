import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve } from "node:path";
import type { StorageAdapter, StoragePutInput } from "./adapter";

export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(options: { root: string; publicBaseUrl: string }) {
    this.root = resolve(options.root);
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, "");
  }

  private resolveKey(key: string): string {
    const normalizedKey = normalize(key);
    const resolved = resolve(this.root, normalizedKey);
    const rel = relative(this.root, resolved);
    // Reject any key that escapes the storage root (path traversal).
    if (rel.startsWith("..") || resolve(this.root, rel) !== resolved) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return resolved;
  }

  async put(input: StoragePutInput): Promise<void> {
    const path = this.resolveKey(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.data);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const path = this.resolveKey(key);
      return await readFile(path);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const path = this.resolveKey(key);
    await rm(path, { force: true });
  }

  async getUrl(key: string): Promise<string> {
    // Validate the key the same way put/get do, even though we don't read the file here.
    this.resolveKey(key);
    return `${this.publicBaseUrl}/${join(key).replace(/\\/g, "/")}`;
  }
}
