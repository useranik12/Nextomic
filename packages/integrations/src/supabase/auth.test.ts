import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConnectorError } from "../errors";
import {
  AuthError,
  authFailure,
  createPkce,
  runAuth,
  sessionOf,
  userOf,
  type AuthResult
} from "./auth";
import { supabaseConnector } from "./connector";
import { AUTH_RESOURCE_ID } from "./auth";

// A tiny GoTrue stand-in on localhost: each test reads what the connector sent.

interface Seen {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
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
      const raw = Buffer.concat(chunks).toString("utf8");
      seen.push({
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
      });
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

const ctx = () => ({
  projectId: "p",
  workspaceId: "w",
  signal: AbortSignal.timeout(5000),
  allowPrivateHosts: true
});
const secrets = { anonKey: "anon-key" };
const run = (params: unknown, token?: string): Promise<AuthResult> =>
  runAuth({ projectUrl: base }, secrets, ctx(), params, token);

const tokenBody = {
  access_token: "access.jwt",
  refresh_token: "refresh-1",
  expires_at: 2_000_000_000,
  user: {
    id: "u1",
    email: "a@b.co",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    user_metadata: { name: "Ann" },
    app_metadata: { role: "member" }
  }
};

describe("supabase auth requests", () => {
  it("signs in by password and returns a session and the user", async () => {
    seen = [];
    reply = { status: 200, body: tokenBody };
    const result = await run({ op: "password", email: "a@b.co", password: "pw" });
    expect(seen[0]?.url).toBe("/auth/v1/token?grant_type=password");
    expect(seen[0]?.body).toEqual({ email: "a@b.co", password: "pw" });
    expect(seen[0]?.headers.apikey).toBe("anon-key");
    expect(seen[0]?.headers.authorization).toBe("Bearer anon-key");
    expect(result.session).toEqual({
      accessToken: "access.jwt",
      refreshToken: "refresh-1",
      expiresAt: 2_000_000_000
    });
    expect(result.user).toMatchObject({
      id: "u1",
      email: "a@b.co",
      emailVerified: true,
      name: "Ann",
      role: "member"
    });
  });

  it("sign-up sends the PKCE challenge and redirect; no session means confirmation is needed", async () => {
    seen = [];
    reply = { status: 200, body: { id: "u2", email: "n@b.co" } };
    const { challenge } = createPkce();
    const result = await run({
      op: "signUp",
      email: "n@b.co",
      password: "pw",
      data: { plan: "x" },
      redirectTo: "https://site.test/api/site/p/auth/callback",
      codeChallenge: challenge
    });
    expect(seen[0]?.url).toBe(
      "/auth/v1/signup?redirect_to=https%3A%2F%2Fsite.test%2Fapi%2Fsite%2Fp%2Fauth%2Fcallback"
    );
    expect(seen[0]?.body).toMatchObject({
      data: { plan: "x" },
      code_challenge: challenge,
      code_challenge_method: "s256"
    });
    expect(result.session).toBeNull();
    expect(result.user?.id).toBe("u2");
  });

  it("sends a code or magic link without creating users", async () => {
    seen = [];
    reply = { status: 200, body: {} };
    await run({ op: "otp", phone: "+15550100" });
    expect(seen[0]?.url).toBe("/auth/v1/otp");
    expect(seen[0]?.body).toMatchObject({ phone: "+15550100", create_user: false });
  });

  it("verifies a code by channel", async () => {
    seen = [];
    reply = { status: 200, body: tokenBody };
    await run({ op: "verify", channel: "phone", phone: "+15550100", token: "123456" });
    expect(seen[0]?.body).toEqual({ phone: "+15550100", type: "sms", token: "123456" });
    await run({ op: "verify", channel: "email", email: "a@b.co", token: "654321" });
    expect(seen[1]?.body).toEqual({ email: "a@b.co", type: "email", token: "654321" });
  });

  it("exchanges a PKCE code and refreshes a session", async () => {
    seen = [];
    reply = { status: 200, body: tokenBody };
    await run({ op: "exchange", authCode: "code-1", codeVerifier: "verifier-1" });
    expect(seen[0]?.url).toBe("/auth/v1/token?grant_type=pkce");
    expect(seen[0]?.body).toEqual({ auth_code: "code-1", code_verifier: "verifier-1" });
    await run({ op: "refresh", refreshToken: "refresh-1" });
    expect(seen[1]?.url).toBe("/auth/v1/token?grant_type=refresh_token");
    expect(seen[1]?.body).toEqual({ refresh_token: "refresh-1" });
  });

  it("calls with the visitor's token for logout, update and user", async () => {
    seen = [];
    reply = { status: 200, body: tokenBody.user };
    await run({ op: "update", password: "new", data: { a: 1 } }, "visitor.jwt");
    expect(seen[0]?.method).toBe("PUT");
    expect(seen[0]?.headers.authorization).toBe("Bearer visitor.jwt");
    expect(seen[0]?.headers.apikey).toBe("anon-key");
    expect(seen[0]?.body).toEqual({ password: "new", data: { a: 1 } });
    const found = await run({ op: "user" }, "visitor.jwt");
    expect(found.user?.id).toBe("u1");
    await run({ op: "logout" }, "visitor.jwt");
    expect(seen[2]?.url).toBe("/auth/v1/logout");
  });

  it("refuses requests that need a session when there is none", async () => {
    await expect(run({ op: "update", password: "x" })).rejects.toMatchObject({
      authCode: "not_signed_in"
    });
    await expect(run({ op: "user" })).rejects.toBeInstanceOf(AuthError);
  });

  it("logout of a token that no longer works is not an error", async () => {
    reply = { status: 401, body: { error_code: "session_not_found", msg: "gone" } };
    await expect(run({ op: "logout" }, "old.jwt")).resolves.toMatchObject({ session: null });
  });

  it("maps failures to standard codes", async () => {
    const cases: [number, unknown, string][] = [
      [
        400,
        { error_code: "invalid_credentials", msg: "Invalid login credentials" },
        "invalid_credentials"
      ],
      [422, { error_code: "user_already_exists", msg: "exists" }, "user_exists"],
      [422, { error_code: "weak_password", msg: "weak" }, "weak_password"],
      [400, { error_code: "email_not_confirmed", msg: "confirm" }, "email_not_verified"],
      [403, { error_code: "otp_expired", msg: "Token has expired or is invalid" }, "otp_expired"],
      [429, { msg: "slow down" }, "rate_limited"],
      [500, { msg: "boom" }, "unknown"]
    ];
    for (const [status, body, code] of cases) {
      reply = { status, body };
      await expect(run({ op: "password", email: "a@b.co", password: "pw" })).rejects.toMatchObject({
        authCode: code
      });
    }
  });

  it("builds the provider address with PKCE and makes no network call", async () => {
    seen = [];
    const result = await run({
      op: "authorizeUrl",
      provider: "google",
      redirectTo: "https://site.test/cb",
      codeChallenge: createPkce().challenge
    });
    expect(seen).toHaveLength(0);
    const url = new URL(result.url ?? "");
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toBe("https://site.test/cb");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  });

  it("rejects bad input before any call", async () => {
    seen = [];
    await expect(run({ op: "password", password: "pw" })).rejects.toBeInstanceOf(ConnectorError);
    await expect(
      run({ op: "authorizeUrl", provider: "Bad Name!", redirectTo: "https://x.test" })
    ).rejects.toBeInstanceOf(ConnectorError);
    await expect(
      run({ op: "otp", email: "a@b.co", codeChallenge: "short" })
    ).rejects.toBeInstanceOf(ConnectorError);
    expect(seen).toHaveLength(0);
  });

  it("runs through the connector's execute on the auth resource", async () => {
    reply = { status: 200, body: tokenBody };
    const result = await supabaseConnector.execute(
      { projectUrl: base, schema: "public", auth: { google: { enabled: false, webClientId: "" } } },
      secrets,
      { resourceId: AUTH_RESOURCE_ID, params: { op: "password", email: "a@b.co", password: "pw" } },
      ctx()
    );
    expect((result.data as AuthResult).user?.id).toBe("u1");
  });
});

describe("auth helpers", () => {
  it("creates a verifier whose S256 challenge matches", async () => {
    const { verifier, challenge } = createPkce();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    expect(Buffer.from(digest).toString("base64url")).toBe(challenge);
    expect(challenge).toHaveLength(43);
    expect(createPkce().verifier).not.toBe(verifier);
  });

  it("reads a session from expires_in when expires_at is missing", () => {
    expect(
      sessionOf({ access_token: "a", refresh_token: "r", expires_in: 100 }, 1_000_000)?.expiresAt
    ).toBe(1100);
    expect(sessionOf({ access_token: "a" })).toBeNull();
  });

  it("reads a user and skips bodies without an id", () => {
    expect(userOf({ email: "x" })).toBeNull();
    expect(userOf({ id: "1", phone: "+1" })?.phone).toBe("+1");
  });

  it("authFailure reads the message and never dumps the body", () => {
    const failure = authFailure({
      status: 400,
      url: "",
      headers: {},
      contentType: "",
      latencyMs: 0,
      body: Buffer.from("<html>not json</html>")
    });
    expect(failure.authCode).toBe("unknown");
    expect(failure.message).not.toContain("html");
  });
});
