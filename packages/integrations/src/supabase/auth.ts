import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ConnectorError } from "../errors";
import { safeFetch, type SafeResponse } from "../safe-fetch";
import type { ConnectorContext } from "../types";

// Supabase Auth (GoTrue) for the visitors of a BUILT app, over its REST API with the anon key
// (docs/app-auth.md). Everything here runs on the server: the connector hands the session (tokens)
// to the caller, which keeps it in an httpOnly cookie and never shows it to the page. Redirect
// flows (OAuth, magic link, password reset, sign-up confirmation) use PKCE: a verifier the caller
// keeps in a short-lived cookie, a challenge Supabase gets, and a `code` exchanged on return.

/** The id of the one resource that runs auth requests. */
export const AUTH_RESOURCE_ID = "auth:session";

const text = (max: number) => z.string().min(1).max(max);
const email = text(320);
const phone = text(40);
const redirect = z.string().url().max(2000);
const challenge = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "The code challenge is not valid.")
  .optional();
const metadata = z.record(z.unknown()).default({});

export const authRequestSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("password"),
    email: email.optional(),
    phone: phone.optional(),
    password: text(1000)
  }),
  z.object({
    op: z.literal("signUp"),
    email,
    password: text(1000),
    data: metadata,
    redirectTo: redirect.optional(),
    codeChallenge: challenge
  }),
  z.object({
    op: z.literal("otp"),
    email: email.optional(),
    phone: phone.optional(),
    redirectTo: redirect.optional(),
    codeChallenge: challenge
  }),
  z.object({
    op: z.literal("verify"),
    channel: z.enum(["email", "phone"]),
    email: email.optional(),
    phone: phone.optional(),
    token: text(32)
  }),
  z.object({ op: z.literal("logout") }),
  z.object({
    op: z.literal("recover"),
    email,
    redirectTo: redirect.optional(),
    codeChallenge: challenge
  }),
  z.object({
    op: z.literal("update"),
    password: text(1000).optional(),
    email: email.optional(),
    phone: phone.optional(),
    data: z.record(z.unknown()).optional(),
    redirectTo: redirect.optional()
  }),
  z.object({ op: z.literal("resend"), email, redirectTo: redirect.optional() }),
  z.object({ op: z.literal("refresh"), refreshToken: text(2000) }),
  z.object({ op: z.literal("user") }),
  z.object({ op: z.literal("exchange"), authCode: text(500), codeVerifier: text(200) }),
  z.object({
    op: z.literal("authorizeUrl"),
    provider: z.string().regex(/^[a-z_]{2,40}$/),
    redirectTo: redirect,
    codeChallenge: challenge
  })
]);
export type AuthRequest = z.infer<typeof authRequestSchema>;

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds when the access token stops working. */
  expiresAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  name: string;
  role: string;
  metadata: Record<string, unknown>;
}

/** What an auth request gives back to the server caller. `session` holds tokens: never show it. */
export interface AuthResult {
  session: AuthSession | null;
  user: AuthUser | null;
  /** The provider's sign-in address (authorizeUrl only). */
  url: string | null;
}

/** Standard error codes the flow's catch part can read (docs/app-auth.md section 5). */
export type AuthErrorCode =
  | "invalid_credentials"
  | "user_exists"
  | "weak_password"
  | "email_not_verified"
  | "otp_invalid"
  | "otp_expired"
  | "rate_limited"
  | "not_signed_in"
  | "unknown";

const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalid_credentials",
  user_already_exists: "user_exists",
  email_exists: "user_exists",
  phone_exists: "user_exists",
  weak_password: "weak_password",
  email_not_confirmed: "email_not_verified",
  phone_not_confirmed: "email_not_verified",
  otp_expired: "otp_expired",
  bad_code_verifier: "otp_invalid",
  validation_failed: "otp_invalid",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  over_sms_send_rate_limit: "rate_limited",
  session_not_found: "not_signed_in",
  session_expired: "not_signed_in",
  refresh_token_not_found: "not_signed_in",
  refresh_token_already_used: "not_signed_in",
  bad_jwt: "not_signed_in"
};

/** An auth failure with a standard code; the message is safe for visitors. */
export class AuthError extends ConnectorError {
  readonly authCode: AuthErrorCode;
  constructor(authCode: AuthErrorCode, message: string, status?: number) {
    super("upstream", message, { status, details: { authCode } });
    this.authCode = authCode;
  }
}

/** Maps a GoTrue error body to a standard code and a visitor-safe message. */
export function authFailure(response: SafeResponse): AuthError {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(response.body.toString("utf8")) as Record<string, unknown>;
  } catch {
    // Not JSON: fall through to the generic failure.
  }
  const raw = typeof body.error_code === "string" ? body.error_code : "";
  const message =
    [body.msg, body.message, body.error_description, body.error].find(
      (v): v is string => typeof v === "string" && v.length > 0
    ) ?? "The sign-in service refused the request.";
  const known = CODE_MAP[raw];
  const code: AuthErrorCode =
    known ??
    (response.status === 429
      ? "rate_limited"
      : /expired/i.test(message)
        ? "otp_expired"
        : /invalid login/i.test(message)
          ? "invalid_credentials"
          : "unknown");
  return new AuthError(code, message.slice(0, 300), response.status);
}

/** A random PKCE verifier and its S256 challenge. */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

interface Config {
  projectUrl: string;
}
interface Secrets {
  anonKey: string;
}

const objectOf = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown): string => (typeof value === "string" ? value : "");

export function userOf(value: unknown): AuthUser | null {
  const raw = objectOf(value);
  const id = str(raw.id);
  if (!id) return null;
  const meta = objectOf(raw.user_metadata);
  return {
    id,
    email: str(raw.email),
    phone: str(raw.phone),
    emailVerified: typeof raw.email_confirmed_at === "string" && raw.email_confirmed_at !== "",
    name: str(meta.name) || str(meta.full_name),
    role: str(objectOf(raw.app_metadata).role) || str(raw.role),
    metadata: meta
  };
}

/** The session of a token response, or null when it holds none (for example, confirmation needed). */
export function sessionOf(value: unknown, now = Date.now()): AuthSession | null {
  const raw = objectOf(value);
  const accessToken = str(raw.access_token);
  const refreshToken = str(raw.refresh_token);
  if (!accessToken || !refreshToken) return null;
  const expiresAt =
    typeof raw.expires_at === "number"
      ? raw.expires_at
      : Math.floor(now / 1000) + (typeof raw.expires_in === "number" ? raw.expires_in : 3600);
  return { accessToken, refreshToken, expiresAt };
}

function parse(response: SafeResponse): unknown {
  if (response.body.length === 0) return {};
  try {
    return JSON.parse(response.body.toString("utf8"));
  } catch {
    throw new AuthError("unknown", "The sign-in service sent a reply that is not JSON.");
  }
}

function pkceFields(code?: string): Record<string, string> {
  return code ? { code_challenge: code, code_challenge_method: "s256" } : {};
}

function redirectQuery(redirectTo?: string): string {
  return redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
}

const ok = (result: Partial<AuthResult> = {}): AuthResult => ({
  session: null,
  user: null,
  url: null,
  ...result
});

/** Runs one auth request. `userToken` is the visitor's access token for the requests that need it. */
export async function runAuth(
  cfg: Config,
  secrets: Secrets,
  ctx: ConnectorContext,
  params: unknown,
  userToken: string | undefined
): Promise<AuthResult> {
  const parsed = authRequestSchema.safeParse(params);
  if (!parsed.success)
    throw new ConnectorError(
      "invalid_request",
      parsed.error.issues[0]?.message ?? "The request is not valid."
    );
  const request = parsed.data;
  const base = `${cfg.projectUrl}/auth/v1`;

  if (request.op === "authorizeUrl") {
    const url = new URL(`${base}/authorize`);
    url.searchParams.set("provider", request.provider);
    url.searchParams.set("redirect_to", request.redirectTo);
    if (request.codeChallenge) {
      url.searchParams.set("code_challenge", request.codeChallenge);
      url.searchParams.set("code_challenge_method", "s256");
    }
    return ok({ url: url.toString() });
  }

  const send = async (
    method: string,
    path: string,
    body?: unknown,
    options: { token?: string; needToken?: boolean } = {}
  ): Promise<unknown> => {
    if (options.needToken && !options.token)
      throw new AuthError("not_signed_in", "Sign in first.", 401);
    const response = await safeFetch(`${base}${path}`, {
      method,
      headers: {
        apikey: secrets.anonKey,
        authorization: `Bearer ${options.token ?? secrets.anonKey}`,
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      allowPrivateHosts: ctx.allowPrivateHosts,
      signal: ctx.signal
    });
    if (response.status >= 400) throw authFailure(response);
    return parse(response);
  };

  switch (request.op) {
    case "password": {
      if (!request.email && !request.phone)
        throw new ConnectorError("invalid_request", "Give an email or a phone.");
      const body = await send("POST", "/token?grant_type=password", {
        ...(request.email ? { email: request.email } : { phone: request.phone }),
        password: request.password
      });
      return ok({ session: sessionOf(body), user: userOf(objectOf(body).user) });
    }
    case "signUp": {
      const body = await send("POST", `/signup${redirectQuery(request.redirectTo)}`, {
        email: request.email,
        password: request.password,
        data: request.data,
        ...pkceFields(request.codeChallenge)
      });
      const raw = objectOf(body);
      // With auto-confirm the reply is a session; otherwise it is the user waiting for confirmation.
      return ok({ session: sessionOf(body), user: userOf(raw.user ?? raw) });
    }
    case "otp": {
      if (!request.email && !request.phone)
        throw new ConnectorError("invalid_request", "Give an email or a phone.");
      await send("POST", `/otp${redirectQuery(request.redirectTo)}`, {
        ...(request.email ? { email: request.email } : { phone: request.phone }),
        create_user: false,
        ...pkceFields(request.codeChallenge)
      });
      return ok();
    }
    case "verify": {
      const identity =
        request.channel === "email"
          ? { email: request.email, type: "email" }
          : { phone: request.phone, type: "sms" };
      if (!identity.email && !identity.phone)
        throw new ConnectorError("invalid_request", "Give the email or phone the code went to.");
      const body = await send("POST", "/verify", { ...identity, token: request.token });
      return ok({ session: sessionOf(body), user: userOf(objectOf(body).user) });
    }
    case "logout": {
      // A token that no longer works is already signed out.
      try {
        await send("POST", "/logout", undefined, { token: userToken, needToken: true });
      } catch (error) {
        if (!(error instanceof AuthError && error.authCode === "not_signed_in")) throw error;
      }
      return ok();
    }
    case "recover": {
      await send("POST", `/recover${redirectQuery(request.redirectTo)}`, {
        email: request.email,
        ...pkceFields(request.codeChallenge)
      });
      return ok();
    }
    case "update": {
      const body = await send(
        "PUT",
        `/user${redirectQuery(request.redirectTo)}`,
        {
          ...(request.password ? { password: request.password } : {}),
          ...(request.email ? { email: request.email } : {}),
          ...(request.phone ? { phone: request.phone } : {}),
          ...(request.data ? { data: request.data } : {})
        },
        { token: userToken, needToken: true }
      );
      return ok({ user: userOf(body) });
    }
    case "resend": {
      await send("POST", `/resend${redirectQuery(request.redirectTo)}`, {
        type: "signup",
        email: request.email
      });
      return ok();
    }
    case "refresh": {
      const body = await send("POST", "/token?grant_type=refresh_token", {
        refresh_token: request.refreshToken
      });
      return ok({ session: sessionOf(body), user: userOf(objectOf(body).user) });
    }
    case "user": {
      const body = await send("GET", "/user", undefined, { token: userToken, needToken: true });
      return ok({ user: userOf(body) });
    }
    case "exchange": {
      const body = await send("POST", "/token?grant_type=pkce", {
        auth_code: request.authCode,
        code_verifier: request.codeVerifier
      });
      return ok({ session: sessionOf(body), user: userOf(objectOf(body).user) });
    }
  }
}
