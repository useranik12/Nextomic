import type { StorageDriver } from "@nextomic/schema";

export interface StorageAdapter {
  readonly driver: StorageDriver;
  put(input: { key: string; body: Uint8Array; contentType: string }): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export { LocalStorageAdapter } from "./local";
