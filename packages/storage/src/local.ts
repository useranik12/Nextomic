import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, normalize, relative, resolve } from "node:path";
import {
  assertStoragePath,
  type StorageAdapter,
  type StorageLocation,
  type StoragePutInput
} from "./adapter";

/** Files on disk: `<root>/<bucket>/<path>`. Used by unit tests. */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(options: { root: string }) {
    this.root = resolve(options.root);
  }

  private resolveLocation({ bucket, path }: StorageLocation): string {
    assertStoragePath(path);
    assertStoragePath(bucket);
    const resolved = resolve(this.root, normalize(`${bucket}/${path}`));
    const rel = relative(this.root, resolved);
    if (rel.startsWith("..") || resolve(this.root, rel) !== resolved)
      throw new Error(`Invalid storage path: ${bucket}/${path}`);
    return resolved;
  }

  async put(input: StoragePutInput): Promise<void> {
    const file = this.resolveLocation(input);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, input.data);
  }

  async get(location: StorageLocation): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolveLocation(location));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(location: StorageLocation): Promise<void> {
    await rm(this.resolveLocation(location), { force: true });
  }

  async deleteMany(bucket: string, paths: readonly string[]): Promise<void> {
    for (const path of paths) await this.delete({ bucket, path });
  }
}
