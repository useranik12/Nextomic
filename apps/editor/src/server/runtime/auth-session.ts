import { createHash } from "node:crypto";
import {
  AUTH_RESOURCE_ID,
  AuthError,
  type AuthResult,
  type AuthSession,
  type AuthUser
} from "@nextomic/integrations";
import type { AppAuthSettings, DynamicContext } from "@nextomic/schema";
import {
  projectConnector,
  projectWorkspaceId,
  siteExecutor,
  type Executor
} from "@/server/queries/run-query";

// The session of a visitor of a BUILT app (docs/app-auth.md section 2). Tokens live only in an
// httpOnly cookie that this server reads and writes; the page never sees them. Each project has its
// own cookie, and the owner preview has one apart from the live site. Supabase checks every token
// (`validate`), so a made-up cookie cannot sign anyone in.

export type SessionMode = "live" | "preview";

const MAX_COOKIE_VALUE = 3800;
const SESSION_DAYS = 30;
/** Refresh when the access token has less than this left. */
const REFRESH_WINDOW = 30;

export const sessionCookieName = (mode: SessionMode, projectId: string) =>
  `nxs_${mode === "live" ? "l" : "p"}_${projectId}`;
export const verifierCookieName = (mode: SessionMode, projectId: string) =>
  `nxv_${mode === "live" ? "l" : "p"}_${projectId}`;

/** The cookie header as a name to value map. */
export function cookiesOf(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    out[part.slice(0, at).trim()] ??= part.slice(at + 1).trim();
  }
  return out;
}

export const isSecureRequest = (headers: Headers): boolean =>
  headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
  (headers.get("origin") ?? "").startsWith("https://");

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
function decode(text: string | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function cookieHeader(
  name: string,
  value: string,
  options: { path: string; maxAge: number; secure: boolean }
): string {
  return [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : [])
  ].join("; ");
}

/** The `Set-Cookie` line that stores a session; throws when it would not fit a cookie. */
export function sessionCookie(
  mode: SessionMode,
  projectId: string,
  session: AuthSession,
  secure: boolean
): string {
  const value = encode({ a: session.accessToken, r: session.refreshToken, e: session.expiresAt });
  if (value.length > MAX_COOKIE_VALUE)
    throw new AuthError(
      "unknown",
      "The session is too large to keep. Remove metadata from the user and try again."
    );
  return cookieHeader(sessionCookieName(mode, projectId), value, {
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
    secure
  });
}

export const clearSessionCookie = (mode: SessionMode, projectId: string, secure: boolean) =>
  cookieHeader(sessionCookieName(mode, projectId), "", { path: "/", maxAge: 0, secure });

/** What the sign-in redirect keeps between leaving for the provider and coming back. */
export interface PendingSignIn {
  verifier: string;
  /** Where to go after the session is set (a path on this site), or "". */
  next: string;
  /** The site the sign-in started on (live or the owner preview). */
  mode: SessionMode;
}

/** Only the callback route may read it. */
export const verifierPath = (projectId: string) => `/api/site/${projectId}/auth`;

export function verifierCookie(
  mode: SessionMode,
  projectId: string,
  pending: PendingSignIn,
  secure: boolean
): string {
  return cookieHeader(verifierCookieName(mode, projectId), encode(pending), {
    path: verifierPath(projectId),
    maxAge: 600,
    secure
  });
}

export const clearVerifierCookie = (mode: SessionMode, projectId: string, secure: boolean) =>
  cookieHeader(verifierCookieName(mode, projectId), "", {
    path: verifierPath(projectId),
    maxAge: 0,
    secure
  });

/** The pending sign-in of this request: the cookie of the live site or of the preview. */
export function readPending(projectId: string, headers: Headers): PendingSignIn | null {
  const cookies = cookiesOf(headers);
  for (const mode of ["live", "preview"] as const) {
    const raw = decode(cookies[verifierCookieName(mode, projectId)]);
    if (typeof raw !== "object" || raw === null) continue;
    const { verifier, next } = raw as Record<string, unknown>;
    if (typeof verifier === "string" && verifier)
      return { verifier, next: typeof next === "string" ? safePath(next) : "", mode };
  }
  return null;
}

/** The stored session of this request, or null. Not checked yet. */
export function readSession(
  mode: SessionMode,
  projectId: string,
  headers: Headers
): AuthSession | null {
  const raw = decode(cookiesOf(headers)[sessionCookieName(mode, projectId)]);
  if (typeof raw !== "object" || raw === null) return null;
  const { a, r, e } = raw as Record<string, unknown>;
  return typeof a === "string" && typeof r === "string" && typeof e === "number" && a && r
    ? { accessToken: a, refreshToken: r, expiresAt: e }
    : null;
}

/** A same-origin path (no scheme, no host, no protocol-relative address), or "". */
export function safePath(value: string | undefined | null): string {
  if (!value || value.length > 2000) return "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(value)) return "";
  return value;
}

export async function callAuth(
  projectId: string,
  execute: Executor,
  params: Record<string, unknown>,
  userToken?: string
): Promise<AuthResult> {
  const row = await projectConnector(projectId, "supabase");
  if (!row) throw new AuthError("unknown", "Connect Supabase first.");
  const result = await execute(row, {
    resourceId: AUTH_RESOURCE_ID,
    params,
    ...(userToken ? { userToken } : {})
  });
  return result.data as AuthResult;
}

// Checked users stay for a short time so a page and its redraw calls do not each ask Supabase.
const CHECK_TTL_MS = 30_000;
const checked = new Map<string, { user: AuthUser; until: number }>();
const tokenKey = (token: string) => createHash("sha256").update(token).digest("hex");

async function validate(
  projectId: string,
  execute: Executor,
  token: string
): Promise<AuthUser | null> {
  const key = tokenKey(token);
  const hit = checked.get(key);
  if (hit && hit.until > Date.now()) return hit.user;
  try {
    const { user } = await callAuth(projectId, execute, { op: "user" }, token);
    if (!user) return null;
    if (checked.size > 5000) checked.clear();
    checked.set(key, { user, until: Date.now() + CHECK_TTL_MS });
    return user;
  } catch {
    // Not signed in, or Supabase cannot be asked right now: either way no visitor is shown.
    return null;
  }
}

// One refresh per refresh token at a time: Supabase refresh tokens are single use, so parallel
// requests must share the answer instead of each spending the token.
const refreshing = new Map<string, Promise<AuthSession | null>>();

export function refreshSession(
  projectId: string,
  execute: Executor,
  session: AuthSession
): Promise<AuthSession | null> {
  const key = `${projectId}:${tokenKey(session.refreshToken)}`;
  const pending = refreshing.get(key);
  if (pending) return pending;
  const task = (async () => {
    try {
      const { session: next } = await callAuth(projectId, execute, {
        op: "refresh",
        refreshToken: session.refreshToken
      });
      return next;
    } catch {
      return null;
    } finally {
      setTimeout(() => refreshing.delete(key), 10_000).unref?.();
    }
  })();
  refreshing.set(key, task);
  return task;
}

export interface Visitor {
  user: AuthUser;
  accessToken: string;
}

export type VisitorState =
  | { kind: "none" }
  /** A cookie exists but the access token ran out: the caller must refresh where it can set cookies. */
  | { kind: "expired" }
  | { kind: "signedIn"; visitor: Visitor };

/** Reads and checks the session of this request; never writes a cookie. */
export async function readVisitor(
  mode: SessionMode,
  projectId: string,
  headers: Headers,
  execute: Executor
): Promise<VisitorState> {
  const session = readSession(mode, projectId, headers);
  if (!session) return { kind: "none" };
  if (session.expiresAt - Math.floor(Date.now() / 1000) < REFRESH_WINDOW)
    return { kind: "expired" };
  const user = await validate(projectId, execute, session.accessToken);
  return user
    ? { kind: "signedIn", visitor: { user, accessToken: session.accessToken } }
    : { kind: "expired" };
}

/** Claims of an access token (base64url payload). Not checked here: Supabase checked the token. */
export function tokenClaims(token: string): Record<string, unknown> {
  const body = decode(token.split(".")[1]);
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/** The `user` of the dynamic context for a signed-in visitor, per the project's token settings. */
export function dynamicUser(
  visitor: Visitor | null,
  auth: Pick<AppAuthSettings, "enabled" | "tokenClaims">
): DynamicContext["user"] {
  if (!visitor || !auth.enabled) return null;
  const { user, accessToken } = visitor;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified,
    name: user.name,
    role: user.role,
    jwt: auth.tokenClaims ? tokenClaims(accessToken) : {},
    accessToken
  };
}

/** The executor that runs auth requests (always the server's own: auth needs no builder member). */
export async function authExecutor(projectId: string): Promise<Executor | null> {
  const workspaceId = await projectWorkspaceId(projectId);
  return workspaceId ? siteExecutor(projectId, workspaceId) : null;
}

/** Sign-in works only with authentication on and Supabase as the provider. */
export const authActive = (auth: Pick<AppAuthSettings, "enabled" | "provider">): boolean =>
  auth.enabled && auth.provider === "supabase";

/** The state of this request's session; "none" when authentication is off or there is no cookie. */
export async function visitorState(
  mode: SessionMode,
  projectId: string,
  headers: Headers,
  auth: Pick<AppAuthSettings, "enabled" | "provider">
): Promise<VisitorState> {
  if (!authActive(auth) || !readSession(mode, projectId, headers)) return { kind: "none" };
  const execute = await authExecutor(projectId);
  return execute ? readVisitor(mode, projectId, headers, execute) : { kind: "none" };
}

/** The checked, signed-in visitor of this request, or null. */
export async function currentVisitor(
  mode: SessionMode,
  projectId: string,
  headers: Headers,
  auth: Pick<AppAuthSettings, "enabled" | "provider">
): Promise<Visitor | null> {
  const state = await visitorState(mode, projectId, headers, auth);
  return state.kind === "signedIn" ? state.visitor : null;
}

/**
 * For endpoints and routes that can write cookies: renews an expired session before the request is
 * read. Returns headers that carry the renewed session and the `Set-Cookie` lines to send. A
 * session that cannot be renewed is cleared.
 */
export async function renewSession(
  mode: SessionMode,
  projectId: string,
  headers: Headers,
  auth: Pick<AppAuthSettings, "enabled" | "provider">
): Promise<{ headers: Headers; setCookies: string[] }> {
  const session = readSession(mode, projectId, headers);
  if (!session || !authActive(auth)) return { headers, setCookies: [] };
  const execute = await authExecutor(projectId);
  if (!execute) return { headers, setCookies: [] };
  const state = await readVisitor(mode, projectId, headers, execute);
  if (state.kind !== "expired") return { headers, setCookies: [] };
  const secure = isSecureRequest(headers);
  const renewed = await refreshSession(projectId, execute, session);
  const next = new Headers(headers);
  const name = sessionCookieName(mode, projectId);
  const others = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${name}=`));
  if (!renewed) {
    next.set("cookie", others.join("; "));
    return { headers: next, setCookies: [clearSessionCookie(mode, projectId, secure)] };
  }
  const line = sessionCookie(mode, projectId, renewed, secure);
  next.set("cookie", [...others, line.split(";")[0] ?? ""].join("; "));
  return { headers: next, setCookies: [line] };
}
