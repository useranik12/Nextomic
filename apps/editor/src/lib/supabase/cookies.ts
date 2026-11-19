import type { CookieOptions } from "@supabase/ssr";
import { SESSION_ONLY_COOKIE, secureCookies } from "./config";

/**
 * The builder session lives in httpOnly cookies and no browser client ever holds the tokens: the
 * published and preview sites are served from this same origin, and their custom scripts must not
 * be able to read a builder session.
 */
export function hardenCookie(options: CookieOptions, sessionOnly: boolean): CookieOptions {
  const next: CookieOptions = {
    ...options,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/"
  };
  if (sessionOnly && (options.maxAge ?? 1) > 0) {
    delete next.maxAge;
    delete next.expires;
  }
  return next;
}

export function isSessionOnly(read: (name: string) => string | undefined): boolean {
  return read(SESSION_ONLY_COOKIE) === "1";
}
