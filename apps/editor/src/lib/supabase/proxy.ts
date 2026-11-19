import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, supabaseConfig } from "./config";
import { hardenCookie, isSessionOnly } from "./cookies";

/**
 * Keeps the session fresh: verifies the access token and, when it has expired, swaps it for a new
 * one through the refresh token, writing the new httpOnly cookies on both the request (so the page
 * being rendered sees them) and the response.
 */
export async function refreshSession(
  request: NextRequest,
  headers: Headers
): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers } });
  const { url, key } = supabaseConfig();
  const supabase = createServerClient(url, key, {
    cookieOptions: { name: AUTH_COOKIE },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, cacheHeaders) => {
        const sessionOnly = isSessionOnly((name) => request.cookies.get(name)?.value);
        for (const { name, value } of list) request.cookies.set(name, value);
        const forwarded = new Headers(headers);
        forwarded.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: forwarded } });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, hardenCookie(options, sessionOnly));
        }
        for (const [name, value] of Object.entries(cacheHeaders)) response.headers.set(name, value);
      }
    },
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false }
  });
  await supabase.auth.getClaims();
  return response;
}
