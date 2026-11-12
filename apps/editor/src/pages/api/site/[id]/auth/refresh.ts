import type { NextApiRequest, NextApiResponse } from "next";
import { getProjectSettings } from "@/server/pages";
import { createRateLimiter } from "@/server/rate-limit";
import { siteHref } from "@/server/runtime/auth-action";
import {
  authExecutor,
  clearSessionCookie,
  isSecureRequest,
  readVisitor,
  renewSession,
  safePath
} from "@/server/runtime/auth-session";
import { headersOf, visitorKey } from "@/server/runtime/site-request";

// Renews an expired visitor session and sends the visitor back to the page they asked for. Server
// pages cannot write cookies while they render, so a page that finds an expired session redirects
// here. The visitor ends up signed in with a fresh session, or signed out; never in a loop.

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
  const mode = request.query.mode === "preview" ? "preview" : "live";
  const next = safePath(typeof request.query.next === "string" ? request.query.next : "") || "/";

  const auth = (await getProjectSettings(id)).appAuth;
  const renewed = await renewSession(mode, id, headers, auth);
  const cookies = [...renewed.setCookies];
  // A renewed session that still does not check out is dropped, so the redirect cannot loop.
  const execute = await authExecutor(id);
  if (execute && renewed.setCookies.length > 0 && !renewed.setCookies[0]?.includes("Max-Age=0")) {
    const state = await readVisitor(mode, id, renewed.headers, execute);
    if (state.kind !== "signedIn")
      cookies.push(clearSessionCookie(mode, id, isSecureRequest(headers)));
  }
  response.setHeader("set-cookie", cookies);
  return response.redirect(303, siteHref(mode, id, next));
}
