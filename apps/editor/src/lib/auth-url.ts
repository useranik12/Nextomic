// The builder's public origin for Better Auth, from BETTER_AUTH_URL (for example
// https://nextomic.kovidaa.com). It builds the links in auth emails and is the origin sign-in
// requests must come from. Extra origins (another domain pointing at the same builder) go in
// BETTER_AUTH_TRUSTED_ORIGINS, comma-separated.

/** `https://host[:port]` from a URL-ish value; tolerates quotes, spaces and a trailing slash. */
export function toOrigin(value: string | undefined): string | null {
  const text = (value ?? "").trim().replace(/^["']|["']$/g, "");
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function authBaseUrl(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  return toOrigin(env.BETTER_AUTH_URL) ?? undefined;
}

export function authTrustedOrigins(
  env: Record<string, string | undefined> = process.env
): string[] {
  const origins = [env.BETTER_AUTH_URL, ...(env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",")]
    .map(toOrigin)
    .filter((origin): origin is string => origin !== null);
  return [...new Set(origins)];
}
