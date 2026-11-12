import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { supabaseConnector } from "./connector";

// A tiny Storage stand-in on localhost: each test reads what the connector sent.

interface Seen {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

let server: Server;
let base = "";
let seen: Seen[] = [];
let reply: { status: number; body: unknown } = { status: 200, body: {} };

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      seen.push({
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
        body: Buffer.concat(chunks)
      });
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

const cfg = () => ({ projectUrl: base, schema: "public", auth: {} }) as never;
const ctx = () => ({
  projectId: "p",
  workspaceId: "w",
  signal: AbortSignal.timeout(5000),
  allowPrivateHosts: true
});
const run = (params: Record<string, unknown>, userToken?: string) =>
  supabaseConnector.execute(
    cfg(),
    { anonKey: "anon-key" },
    { resourceId: "bucket:docs", params, userToken },
    ctx()
  );

describe("supabase storage uploads and deletes", () => {
  it("uploads the bytes as the visitor", async () => {
    seen = [];
    reply = { status: 200, body: { Key: "docs/a/b c.png" } };
    const bytes = Buffer.from([1, 2, 3, 250]);
    const result = await run(
      {
        op: "storage.upload",
        path: "a/b c.png",
        data: bytes.toString("base64"),
        contentType: "image/png",
        upsert: true
      },
      "visitor.jwt"
    );
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("/storage/v1/object/docs/a/b%20c.png");
    expect(seen[0]?.headers.authorization).toBe("Bearer visitor.jwt");
    expect(seen[0]?.headers["content-type"]).toBe("image/png");
    expect(seen[0]?.headers["x-upsert"]).toBe("true");
    expect(seen[0]?.body.equals(bytes)).toBe(true);
    expect(result.data).toEqual({ path: "a/b c.png", size: 4 });
  });

  it("reports a refused upload", async () => {
    reply = { status: 403, body: { message: "new row violates row-level security policy" } };
    await expect(
      run({ op: "storage.upload", path: "a.png", data: "AQ==", contentType: "image/png" })
    ).rejects.toThrow();
  });

  it("reads the real status Storage puts in the body of a 400", async () => {
    reply = {
      status: 400,
      body: {
        statusCode: "403",
        error: "Unauthorized",
        message: "new row violates row-level security policy"
      }
    };
    await expect(
      run({ op: "storage.upload", path: "a.png", data: "AQ==", contentType: "image/png" })
    ).rejects.toMatchObject({ status: 403 });
    reply = { status: 400, body: { statusCode: "404", message: "Bucket not found" } };
    await expect(
      run({ op: "storage.upload", path: "a.png", data: "AQ==", contentType: "image/png" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("deletes a list of paths", async () => {
    seen = [];
    reply = { status: 200, body: [{ name: "a.png" }, { name: "b.png" }] };
    const result = await run({ op: "storage.remove", paths: ["a.png", "b.png"] }, "visitor.jwt");
    expect(seen[0]?.method).toBe("DELETE");
    expect(seen[0]?.url).toBe("/storage/v1/object/docs");
    expect(JSON.parse(seen[0]?.body.toString("utf8") ?? "{}")).toEqual({
      prefixes: ["a.png", "b.png"]
    });
    expect(result.data).toEqual({ removed: 2 });
  });

  it("refuses an empty or oversized path list", async () => {
    await expect(run({ op: "storage.remove", paths: [] })).rejects.toThrow();
    await expect(
      run({ op: "storage.remove", paths: Array.from({ length: 101 }, (_, i) => `f${i}`) })
    ).rejects.toThrow();
  });
});
