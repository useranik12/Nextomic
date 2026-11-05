import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import type { StorageAdapter } from "./index";

function resolveStoragePath(root: string, key: string): string {
  const absoluteRoot = resolve(root);
  const filePath = resolve(absoluteRoot, key);
  if (filePath !== absoluteRoot && !filePath.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error("Storage key must resolve inside the configured local storage root.");
  }
  return filePath;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;

  constructor(private readonly root = process.env.STORAGE_LOCAL_PATH ?? "./storage") {}

  async put(input: { key: string; body: Uint8Array; contentType: string }): Promise<void> {
    const target = resolveStoragePath(this.root, input.key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(resolveStoragePath(this.root, key));
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(resolveStoragePath(this.root, key));
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}
