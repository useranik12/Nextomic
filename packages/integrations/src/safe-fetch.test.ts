import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanHeaders, contentTypeAllowed, safeFetch } from "./safe-fetch";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const routes = new Map<string, Handler>();
let server: Server;
let base = "";
let lastHeaders: IncomingMessage["headers"] = {};

const json = (res: ServerResponse, value: unknown, status = 200) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
};

beforeAll(async () => {
  server = createServer((req, res) => {
    lastHeaders = req.headers;
    const handler = routes.get(new URL(req.url ?? "/", "http://x").pathname);
    if (handler) handler(req, res);
    else json(res, { error: "missing" }, 404);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  routes.set("/ok", (req, res) => json(res, { method: req.method }));
  routes.set("/echo", (req, res) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString()));
    req.on("end", () => json(res, { method: req.method, body }));
  });
  routes.set("/gzip", (_req, res) => {
    res.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip" });
    res.end(gzipSync(JSON.stringify({ zipped: true })));
  });
  routes.set("/bomb", (_req, res) => {
    res.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" });
    res.end(gzipSync(Buffer.alloc(200_000, 97)));
  });
  routes.set("/html-binary", (_req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(Buffer.from([1, 2, 3]));
  });
  routes.set("/slow", (_req, res) => {
    setTimeout(() => json(res, { late: true }), 500);
  });
  routes.set("/hop", (req, res) => {
    const n = Number(new URL(req.url ?? "", "http://x").searchParams.get("n") ?? 0);
    res.writeHead(302, { location: n > 0 ? `/hop?n=${n - 1}` : "/ok" });
    res.end();
  });
  routes.set("/see-other", (_req, res) => {
    res.writeHead(303, { location: "/echo" });
    res.end();
  });
  routes.set("/to-metadata", (_req, res) => {
    res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
    res.end();
  });
  routes.set("/to-other-origin", (_req, res) => {
    res.writeHead(307, { location: `http://localhost:${new URL(base).port}/ok` });
    res.end();
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const dev = { allowPrivateHosts: true };

describe("safeFetch", () => {
  it("fetches and decodes json", async () => {
    const res = await safeFetch(`${base}/ok`, dev);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body.toString())).toEqual({ method: "GET" });
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("refuses private hosts and plain http unless allowed", async () => {
    await expect(safeFetch(`${base}/ok`, { allowPrivateHosts: false })).rejects.toMatchObject({
      code: "blocked_host"
    });
    await expect(
      safeFetch("https://internal.example/", {
        allowPrivateHosts: false,
        resolve: async () => ["8.8.8.8", "10.0.0.5"]
      })
    ).rejects.toMatchObject({ code: "blocked_host" });
    await expect(
      safeFetch("https://meta.example/", {
        allowPrivateHosts: true,
        resolve: async () => ["169.254.169.254"]
      })
    ).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("refuses credentials in the address and bad urls", async () => {
    await expect(safeFetch("https://user:pass@example.com/", dev)).rejects.toMatchObject({
      code: "invalid_request"
    });
    await expect(safeFetch("not a url", dev)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(safeFetch("ftp://example.com/", dev)).rejects.toMatchObject({
      code: "blocked_host"
    });
  });

  it("sends a body and strips connection headers", async () => {
    const res = await safeFetch(`${base}/echo`, {
      ...dev,
      method: "POST",
      body: "hello",
      headers: {
        "Content-Type": "text/plain",
        Host: "evil.example",
        Connection: "close",
        "X-A": "1"
      }
    });
    expect(JSON.parse(res.body.toString())).toEqual({ method: "POST", body: "hello" });
    expect(lastHeaders.host).toBe(new URL(base).host);
    expect(lastHeaders["x-a"]).toBe("1");
  });

  it("follows up to 3 redirects and re-checks each one", async () => {
    expect((await safeFetch(`${base}/hop?n=2`, dev)).status).toBe(200);
    await expect(safeFetch(`${base}/hop?n=3`, dev)).rejects.toMatchObject({
      code: "too_many_redirects"
    });
    await expect(safeFetch(`${base}/to-metadata`, dev)).rejects.toMatchObject({
      code: "blocked_host"
    });
  });

  it("turns a 303 into a GET and drops credentials on another origin", async () => {
    const res = await safeFetch(`${base}/see-other`, { ...dev, method: "POST", body: "x" });
    expect(JSON.parse(res.body.toString())).toEqual({ method: "GET", body: "" });
    await safeFetch(`${base}/to-other-origin`, {
      ...dev,
      resolve: async () => ["127.0.0.1"],
      headers: { Authorization: "Bearer secret", "X-Keep": "yes" }
    });
    expect(lastHeaders.authorization).toBeUndefined();
    expect(lastHeaders["x-keep"]).toBe("yes");
  });

  it("decompresses and caps the decoded size", async () => {
    const res = await safeFetch(`${base}/gzip`, dev);
    expect(JSON.parse(res.body.toString())).toEqual({ zipped: true });
    await expect(safeFetch(`${base}/bomb`, { ...dev, maxBytes: 10_000 })).rejects.toMatchObject({
      code: "too_large"
    });
  });

  it("rejects unsupported content types", async () => {
    await expect(safeFetch(`${base}/html-binary`, dev)).rejects.toMatchObject({
      code: "bad_content_type"
    });
  });

  it("times out", async () => {
    await expect(safeFetch(`${base}/slow`, { ...dev, timeoutMs: 100 })).rejects.toMatchObject({
      code: "timeout"
    });
  });
});

describe("header and type helpers", () => {
  it("cleans headers", () => {
    expect(
      cleanHeaders({
        "X-Ok": "1",
        host: "h",
        "Transfer-Encoding": "chunked",
        "bad name": "x",
        "X-Inject": "a\r\nb: c"
      })
    ).toEqual({ "x-ok": "1" });
  });

  it("matches content types", () => {
    const rules = ["application/json", "+json", "text/"];
    expect(contentTypeAllowed("application/json; charset=utf-8", rules)).toBe(true);
    expect(contentTypeAllowed("application/vnd.pgrst.object+json", rules)).toBe(true);
    expect(contentTypeAllowed("text/csv", rules)).toBe(true);
    expect(contentTypeAllowed("image/png", rules)).toBe(false);
    expect(contentTypeAllowed("", rules)).toBe(false);
  });
});
