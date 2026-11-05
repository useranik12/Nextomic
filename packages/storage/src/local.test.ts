import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStorageAdapter } from "./local";

describe("LocalStorageAdapter", () => {
  let root: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "nextomic-storage-"));
    adapter = new LocalStorageAdapter({ root, publicBaseUrl: "https://files.example.com" });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips a put/get", async () => {
    await adapter.put({
      key: "workspaces/w1/media/hello.txt",
      data: Buffer.from("hello"),
      contentType: "text/plain"
    });
    const data = await adapter.get("workspaces/w1/media/hello.txt");
    expect(data && Buffer.from(data).toString()).toBe("hello");
  });

  it("returns null for a missing key", async () => {
    expect(await adapter.get("does/not/exist.txt")).toBeNull();
  });

  it("deletes a stored object", async () => {
    await adapter.put({ key: "a.txt", data: Buffer.from("x"), contentType: "text/plain" });
    await adapter.delete("a.txt");
    expect(await adapter.get("a.txt")).toBeNull();
  });

  it("builds a public URL from the key", async () => {
    await adapter.put({ key: "a.txt", data: Buffer.from("x"), contentType: "text/plain" });
    expect(await adapter.getUrl("a.txt")).toBe("https://files.example.com/a.txt");
  });

  it("rejects a key that escapes the storage root", async () => {
    await expect(
      adapter.put({ key: "../escape.txt", data: Buffer.from("x"), contentType: "text/plain" })
    ).rejects.toThrow("Invalid storage key");
  });
});
