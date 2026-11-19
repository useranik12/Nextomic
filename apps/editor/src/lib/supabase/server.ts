import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE, supabaseConfig } from "./config";
import { hardenCookie, isSessionOnly } from "./cookies";

/**
 * A Supabase Auth client bound to the request's cookies, for server components, server actions and
 * route handlers. Make a new one per request. Tokens refresh through the proxy, so setting cookies
 * from a server component (where Next forbids it) is skipped quietly.
 */
export async function createSupabaseServer() {
  const store = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list, headers) => {
        void headers;
        const sessionOnly = isSessionOnly((name) => store.get(name)?.value);
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, hardenCookie(options, sessionOnly));
          }
        } catch {
          // Called from a server component: the proxy keeps the session fresh instead.
        }
      }
    },
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false }
  });
}

export type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>;

/** A read-only client for a request whose cookies arrive as a header; it never writes cookies. */
export function createSupabaseFromHeaders(headers: Headers) {
  const { url, key } = supabaseConfig();
  const parsed = parseCookieHeader(headers.get("cookie") ?? "");
  return createServerClient(url, key, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll: () => parsed.map(({ name, value }) => ({ name, value: value ?? "" })),
      setAll: () => {}
    },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}
