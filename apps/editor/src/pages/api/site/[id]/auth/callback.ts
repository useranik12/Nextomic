import type { NextApiRequest, NextApiResponse } from "next";
import { AuthError } from "@nextomic/integrations";
import { getProjectSettings } from "@/server/pages";
import { createRateLimiter } from "@/server/rate-limit";
import { pageRoute, siteHref } from "@/server/runtime/auth-action";
import {
  authActive,
  authExecutor,
  callAuth,
  clearVerifierCookie,
  isSecureRequest,
  readPending,
  safePath,
  sessionCookie
} from "@/server/runtime/auth-session";
import { headersOf, visitorKey } from "@/server/runtime/site-request";

// Where Supabase sends a visitor back after OAuth, a magic link, a password reset link or a sign-up
// confirmation link (docs/app-auth.md sections 2 and 5). The address `/api/site/<id>/auth/callback`
// must be in Supabase's redirect allow-list. The visitor arrives with a `code`; the PKCE verifier
// kept in a short-lived httpOnly cookie turns it into a session, which is stored in the session
// cookie. The visitor then goes to a path of this site (never anywhere else).

const PER_VISITOR = createRateLimiter(30, 60_000);

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader("cache-control", "no-store");
  const id = typeof request.query.id === "string" ? request.query.id : "";
  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    return response.status(405).end();
  }
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return response.status(404).end();
  const headers = headersOf(request);
  if (!PER_VISITOR.take(`${id}:${visitorKey(headers)}`).ok) return response.status(429).end();

  const settings = await getProjectSettings(id);
  const pending = readPending(id, headers);
  const secure = isSecureRequest(headers);
  const mode = pending?.mode ?? "live";
  const entry = (await pageRoute(id, settings.appAuth.entryPageId)) ?? "/";
  const failTo = (code: string) =>
    siteHref(mode, id, `${entry}${entry.includes("?") ? "&" : "?"}auth_error=${code}`);
  const cookies = pending ? [clearVerifierCookie(pending.mode, id, secure)] : [];
  const go = (location: string) => {
    response.setHeader("set-cookie", cookies);
    response.redirect(303, location);
  };

  const code = typeof request.query.code === "string" ? request.query.code : "";
  if (!authActive(settings.appAuth) || !pending || !code) {
    const provider =
      typeof request.query.error_code === "string" ? request.query.error_code : "unknown";
    return go(failTo(pending && !code ? provider.slice(0, 40).replace(/\W/g, "") : "unknown"));
  }
  try {
    const execute = await authExecutor(id);
    if (!execute) return go(failTo("unknown"));
    const { session } = await callAuth(id, execute, {
      op: "exchange",
      authCode: code,
      codeVerifier: pending.verifier
    });
    if (!session) return go(failTo("unknown"));
    cookies.push(sessionCookie(pending.mode, id, session, secure));
    const landing =
      safePath(pending.next) || (await pageRoute(id, settings.appAuth.loggedInPageId)) || "/";
    return go(siteHref(pending.mode, id, landing));
  } catch (error) {
    return go(failTo(error instanceof AuthError ? error.authCode : "unknown"));
  }
}
