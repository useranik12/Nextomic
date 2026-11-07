import { randomBytes } from "node:crypto";
import {
  ConnectorError,
  encryptSecrets,
  keyringFromEnv,
  normalizeError,
  registerConnector,
  type ConnectorContext
} from "@nextomic/integrations";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { operationSchema, runOperation, type StoredConnector } from "./operation";

const keyring = keyringFromEnv({ ENCRYPTION_KEY: randomBytes(32).toString("base64") });
const seen: { secrets?: unknown; ctx?: ConnectorContext } = {};

// A stand-in registered under "rest" so the pipeline can run without the network.
registerConnector({
  type: "rest",
  configSchema: z.object({ baseUrl: z.string().url() }),
  secretsSchema: z.object({ token: z.string().min(1) }),
  async test(_cfg, secrets, ctx) {
    seen.secrets = secrets;
    seen.ctx = ctx;
    return { ok: true, message: "Connected", latencyMs: 1 };
  },
  async listResources() {
    return [{ id: "users", kind: "endpoint", name: "Users" }];
  },
  async execute(_cfg, _secrets, req) {
    if (req.resourceId === "boom") throw new Error("upstream stack trace with token=abc");
    return { status: 200, data: { echo: req.params } };
  }
});

function row(over: Partial<StoredConnector> = {}): StoredConnector {
  const sealed = encryptSecrets({ token: "s3cret" }, "c1", keyring);
  return {
    id: "c1",
    type: "rest",
    active: true,
    config: { baseUrl: "https://api.example.com" },
    secretCiphertext: sealed.ciphertext,
    secretIv: sealed.iv,
    secretTag: sealed.tag,
    keyVersion: sealed.keyVersion,
    ...over
  };
}

const ctx = { projectId: "p", workspaceId: "w", allowPrivateHosts: false, keyring: () => keyring };

describe("connector operation", () => {
  it("decrypts secrets and passes the context", async () => {
    await expect(runOperation(row(), { op: "test" }, ctx)).resolves.toMatchObject({ ok: true });
    expect(seen.secrets).toEqual({ token: "s3cret" });
    expect(seen.ctx).toMatchObject({ projectId: "p", workspaceId: "w", allowPrivateHosts: false });
    expect(seen.ctx?.signal).toBeInstanceOf(AbortSignal);
  });

  it("lists resources and executes", async () => {
    await expect(runOperation(row(), { op: "resources" }, ctx)).resolves.toHaveLength(1);
    await expect(
      runOperation(
        row(),
        { op: "execute", request: { resourceId: "users", params: { q: 1 } } },
        ctx
      )
    ).resolves.toEqual({ status: 200, data: { echo: { q: 1 } } });
  });

  it("refuses to execute a connector that is off, but still tests it", async () => {
    const off = row({ active: false });
    await expect(
      runOperation(off, { op: "execute", request: { resourceId: "users", params: {} } }, ctx)
    ).rejects.toThrow(/turned off/);
    await expect(runOperation(off, { op: "test" }, ctx)).resolves.toMatchObject({ ok: true });
  });

  it("rejects invalid config, missing secrets and unknown types", async () => {
    await expect(
      runOperation(row({ config: { baseUrl: "nope" } }), { op: "test" }, ctx)
    ).rejects.toThrow(/settings are not valid/);
    await expect(
      runOperation(row({ secretCiphertext: null }), { op: "test" }, ctx)
    ).rejects.toThrow(/secrets are incomplete/);
    await expect(
      runOperation(row({ type: "supabase" }), { op: "test" }, ctx)
    ).rejects.toBeInstanceOf(ConnectorError);
  });

  it("never leaks upstream errors", async () => {
    const error = await runOperation(
      row(),
      { op: "execute", request: { resourceId: "boom", params: {} } },
      ctx
    ).catch((e: unknown) => e);
    const normalized = normalizeError(error);
    expect(normalized).toEqual({ code: "internal", message: "The connector call failed." });
    expect(JSON.stringify(normalized)).not.toContain("abc");
  });

  it("validates the request shape", () => {
    expect(operationSchema.safeParse({ op: "drop" }).success).toBe(false);
    expect(operationSchema.safeParse({ op: "execute", request: { resourceId: "" } }).success).toBe(
      false
    );
    expect(operationSchema.safeParse({ op: "test" }).success).toBe(true);
  });
});
