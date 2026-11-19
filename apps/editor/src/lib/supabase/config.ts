/** Where the builder reaches its Supabase: the API gateway (server side only) and the publishable key. */
export function supabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  return { url, key };
}

/** Cookie name prefix of the builder session. Built-app sessions use their own names. */
export const AUTH_COOKIE = "nextomic-auth";
/** Set when "Remember me" is off: the session cookies then last only for the browser session. */
export const SESSION_ONLY_COOKIE = "nextomic-session-only";

/** The builder's public address (no path), used for links in auth emails and cookie security. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function secureCookies(): boolean {
  return appUrl().startsWith("https://");
}
