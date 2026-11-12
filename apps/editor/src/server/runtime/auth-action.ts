import { AuthError, createPkce, type AuthResult, type AuthUser } from "@nextomic/integrations";
import type { ActionDef, AppAuthSettings, Params } from "@nextomic/schema";
import { listPages } from "@/server/pages";
import type { Executor } from "@/server/queries/run-query";
import {
  authActive,
  callAuth,
  clearSessionCookie,
  isSecureRequest,
  readSession,
  safePath,
  sessionCookie,
  verifierCookie,
  type SessionMode,
  type Visitor
} from "@/server/runtime/auth-session";

// Runs the sign-in actions of a built app (docs/app-auth.md section 5) for the action endpoint. The
// params are the saved node's with the browser's filled tag values (see server-action.ts), so the
// method, provider and redirects are the owner's; the visitor supplies only what a tag fills. Every
// redirect is a path on this site. Cookies are returned as `Set-Cookie` lines for the endpoint to
// send; tokens never leave the server.

/** What an auth action answers to the page: no token, ever. */
export interface PublicUser {
  id: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  name: string;
  role: string;
  metadata: Record<string, unknown>;
}

export interface AuthOutcome {
  data: PublicUser | null;
  setCookies: string[];
  /** Leave now for this absolute address (the OAuth provider). */
  go?: string;
  /**
   * Where to go once the flow has ended and nothing else navigated: a route of this site, or null
   * to reload so `{{ user.* }}` shows the new state.
   */
  after?: { redirect: string | null };
}

const text = (params: Params, key: string): string =>
  typeof params[key] === "string" ? (params[key] as string).trim() : "";
const rowsOf = (value: unknown): Record<string, string>[] =>
  Array.isArray(value) ? (value as Record<string, string>[]) : [];

export const publicUser = (user: AuthUser | null): PublicUser | null =>
  user
    ? {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        name: user.name,
        role: user.role,
        metadata: user.metadata
      }
    : null;

/** The address of this site as the visitor sees it. */
export function siteOrigin(headers: Headers): string {
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (headers.get("origin") ?? "").split(":")[0] ||
    "http";
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

/** The one address Supabase sends visitors back to (it must be in Supabase's redirect allow-list). */
export const callbackUrl = (headers: Headers, projectId: string) =>
  `${siteOrigin(headers)}/api/site/${projectId}/auth/callback`;

/** The URL of a route of this site for a server redirect (callback). */
export function siteHref(mode: SessionMode, projectId: string, route: string): string {
  const id = encodeURIComponent(projectId);
  const path = safePath(route) || "/";
  if (mode === "live") return `/site/${id}${path === "/" ? "" : path}`;
  const url = new URL(path, "http://site.invalid");
  const params = new URLSearchParams(url.search);
  params.set("path", url.pathname);
  return `/preview/${id}?${params.toString()}`;
}

/** The route of a page chosen in App Settings, or null when none is chosen. */
export async function pageRoute(projectId: string, pageId: string): Promise<string | null> {
  if (!pageId) return null;
  const page = (await listPages(projectId)).find((p) => p.id === pageId);
  return page?.route ?? null;
}

export interface RunAuthInput {
  projectId: string;
  mode: SessionMode;
  def: ActionDef;
  params: Params;
  headers: Headers;
  execute: Executor;
  settings: AppAuthSettings;
  /** The checked, signed-in visitor of this request (after any renewal), or null. */
  visitor: Visitor | null;
  /** The query string of the page the action runs on (`?next=` brings the visitor back after sign-in). */
  search: string;
}

export async function runAuthAction(input: RunAuthInput): Promise<AuthOutcome> {
  const { projectId, mode, def, params, headers, execute, settings, visitor, search } = input;
  if (!settings.enabled)
    throw new AuthError("unknown", "Turn on authentication in App Settings first.");
  if (!authActive(settings))
    throw new AuthError(
      "unknown",
      "These actions work with Supabase as the sign-in provider (App Settings > Authentication)."
    );
  const secure = isSecureRequest(headers);
  const callback = callbackUrl(headers, projectId);
  const call = (request: Record<string, unknown>, token?: string): Promise<AuthResult> =>
    callAuth(projectId, execute, request, token);
  const needSession = () => {
    if (!visitor) throw new AuthError("not_signed_in", "Sign in first.", 401);
    return visitor.accessToken;
  };
  /** Stores a new session and tells the page to show the signed-in state. */
  const signedIn = async (result: AuthResult): Promise<AuthOutcome> => {
    if (!result.session) return { data: publicUser(result.user), setCookies: [] };
    const route =
      safePath(new URLSearchParams(search).get("next")) ||
      (await pageRoute(projectId, settings.loggedInPageId));
    return {
      data: publicUser(result.user),
      setCookies: [sessionCookie(mode, projectId, result.session, secure)],
      after: { redirect: route }
    };
  };
  /** A redirect flow: PKCE challenge to Supabase, verifier in a short-lived cookie. */
  const pkce = (next: string) => {
    const { verifier, challenge } = createPkce();
    return {
      challenge,
      cookie: verifierCookie(mode, projectId, { verifier, next, mode }, secure)
    };
  };
  const next = safePath(text(params, "redirect"));

  switch (def.type) {
    case "auth.login": {
      const method = text(params, "method") || "password";
      if (method === "password") {
        const email = text(params, "email");
        const phone = text(params, "phone");
        return signedIn(
          await call({
            op: "password",
            ...(email ? { email } : { phone }),
            password: text(params, "password")
          })
        );
      }
      if (method === "oauth") {
        const flow = pkce(next);
        const result = await call({
          op: "authorizeUrl",
          provider: text(params, "provider"),
          redirectTo: callback,
          codeChallenge: flow.challenge
        });
        return { data: null, setCookies: [flow.cookie], go: result.url ?? undefined };
      }
      if (method === "magicLink") {
        const flow = pkce(next);
        await call({
          op: "otp",
          email: text(params, "email"),
          redirectTo: callback,
          codeChallenge: flow.challenge
        });
        return { data: null, setCookies: [flow.cookie] };
      }
      if (method === "emailOtp") {
        await call({ op: "otp", email: text(params, "email") });
        return { data: null, setCookies: [] };
      }
      await call({ op: "otp", phone: text(params, "phone") });
      return { data: null, setCookies: [] };
    }
    case "auth.verifyOtp": {
      const channel = text(params, "channel") === "phone" ? "phone" : "email";
      return signedIn(
        await call({
          op: "verify",
          channel,
          ...(channel === "email"
            ? { email: text(params, "email") }
            : { phone: text(params, "phone") }),
          token: text(params, "code")
        })
      );
    }
    case "auth.register": {
      const flow = pkce("");
      const data: Record<string, string> = {};
      for (const row of rowsOf(params.metadata)) if (row.name) data[row.name] = row.value ?? "";
      const result = await call({
        op: "signUp",
        email: text(params, "email"),
        password: text(params, "password"),
        data,
        redirectTo: callback,
        codeChallenge: flow.challenge
      });
      const outcome = await signedIn(result);
      // No session yet: the email must be confirmed, and the link returns through the callback.
      return result.session ? outcome : { ...outcome, setCookies: [flow.cookie] };
    }
    case "auth.logout": {
      const session = readSession(mode, projectId, headers);
      if (visitor || session) {
        try {
          await call({ op: "logout" }, visitor?.accessToken ?? session?.accessToken);
        } catch (error) {
          // The session is dropped here whatever Supabase answers.
          if (!(error instanceof AuthError)) throw error;
        }
      }
      return {
        data: null,
        setCookies: [clearSessionCookie(mode, projectId, secure)],
        after: { redirect: next || null }
      };
    }
    case "auth.sendPasswordReset": {
      const flow = pkce(next);
      await call({
        op: "recover",
        email: text(params, "email"),
        redirectTo: callback,
        codeChallenge: flow.challenge
      });
      return { data: null, setCookies: [flow.cookie] };
    }
    case "auth.updatePassword":
      return { ...(await updated(call, needSession(), { password: text(params, "password") })) };
    case "auth.updateEmail":
      return await updated(call, needSession(), {
        email: text(params, "email"),
        redirectTo: callback
      });
    case "auth.updatePhone":
      return await updated(call, needSession(), { phone: text(params, "phone") });
    case "auth.updateUser": {
      const data: Record<string, string> = {};
      for (const row of rowsOf(params.metadata)) if (row.name) data[row.name] = row.value ?? "";
      return await updated(call, needSession(), { data });
    }
    case "auth.resendVerification": {
      await call({ op: "resend", email: text(params, "email"), redirectTo: callback });
      return { data: null, setCookies: [] };
    }
    default:
      throw new AuthError("unknown", "This sign-in action is not available.");
  }
}

async function updated(
  call: (request: Record<string, unknown>, token?: string) => Promise<AuthResult>,
  token: string,
  fields: Record<string, unknown>
): Promise<AuthOutcome> {
  const result = await call({ op: "update", ...fields }, token);
  return { data: publicUser(result.user), setCookies: [] };
}
