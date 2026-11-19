import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStorageAdapter } from "./local";

const bucket = "app-uploads";

describe("LocalStorageAdapter", () => {
  let root: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "nxt-storage-"));
    adapter = new LocalStorageAdapter({ root });
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it("stores and reads bytes under bucket and path", async () => {
    const data = new TextEncoder().encode("hello");
    await adapter.put({ bucket, path: "a/b/c.txt", data, contentType: "text/plain" });
    const read = await adapter.get({ bucket, path: "a/b/c.txt" });
    expect(Buffer.from(read ?? []).toString()).toBe("hello");
  });

  it("keeps buckets apart", async () => {
    await adapter.put({ bucket, path: "x", data: new Uint8Array([1]), contentType: "a/b" });
    expect(await adapter.get({ bucket: "customer-data", path: "x" })).toBeNull();
  });

  it("returns null for a missing object and ignores deleting one", async () => {
    expect(await adapter.get({ bucket, path: "nope" })).toBeNull();
    await expect(adapter.delete({ bucket, path: "nope" })).resolves.toBeUndefined();
  });

  it("deletes one or many objects", async () => {
    for (const path of ["p/1", "p/2", "p/3"])
      await adapter.put({ bucket, path, data: new Uint8Array([1]), contentType: "a/b" });
    await adapter.delete({ bucket, path: "p/1" });
    await adapter.deleteMany(bucket, ["p/2", "p/3"]);
    for (const path of ["p/1", "p/2", "p/3"])
      expect(await adapter.get({ bucket, path })).toBeNull();
  });

  it("rejects paths that escape the bucket", async () => {
    for (const path of ["../x", "a/../../x", "/abs", "a//b", "a\\b"])
      await expect(adapter.get({ bucket, path })).rejects.toThrow(/Invalid storage path/);
  });
});
