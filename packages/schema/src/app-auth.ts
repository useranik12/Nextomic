import { z } from "zod";
import { mapExpressions } from "./state-usage";

// Authentication settings of the BUILT app (App Settings > Authentication, docs/app-auth.md).
// Pages are referred to by id; an empty id means "not chosen".

export const APP_AUTH_PROVIDERS = ["supabase", "custom"] as const;
export type AppAuthProvider = (typeof APP_AUTH_PROVIDERS)[number];

export const appAuthSettingsSchema = z.object({
  /** Off: no page can require sign-in and auth actions are hidden. */
  enabled: z.boolean().default(false),
  /** New pages start with "Requires Authentication" checked. */
  requireByDefault: z.boolean().default(false),
  /** Login page: never requires sign-in; signed-in users are sent away from it. */
  entryPageId: z.string().max(64).default(""),
  /** Where users go after signing in when the action flow has no navigation of its own. */
  loggedInPageId: z.string().max(64).default(""),
  provider: z.enum(APP_AUTH_PROVIDERS).default("supabase"),
  /** Custom provider only: the app data type that holds the signed-in user's data. */
  userDataTypeId: z.string().max(64).default(""),
  /**
   * Keep the decoded claims of the signed-in user's access token as one JSON tag, `{{user.jwt}}`
   * (read with dot notation). The token is decoded on the server; claims are not secret.
   */
  tokenClaims: z.boolean().default(false),
  /**
   * Opt-in, off by default: expose the RAW access token as `{{user.accessToken}}`. Any script on
   * the page could read it, so it is never given to custom code elements.
   */
  exposeAccessToken: z.boolean().default(false)
});
export type AppAuthSettings = z.infer<typeof appAuthSettingsSchema>;

export const defaultAppAuthSettings = (): AppAuthSettings => appAuthSettingsSchema.parse({});

/** Whether a page requires sign-in: the login page never does, and nothing does with auth off. */
export function pageRequiresAuth(
  auth: AppAuthSettings,
  page: { id: string; requiresAuth: boolean }
): boolean {
  return auth.enabled && page.id !== auth.entryPageId && page.requiresAuth;
}

/** Which token tags the built app offers: only with authentication on. */
export function tokenTags(auth: AppAuthSettings): { claims: boolean; raw: boolean } {
  return {
    claims: auth.enabled && auth.tokenClaims,
    raw: auth.enabled && auth.exposeAccessToken
  };
}

/** "Requires Authentication" for a page being created now. */
export const newPageRequiresAuth = (auth: AppAuthSettings): boolean =>
  auth.enabled && auth.requireByDefault;

const RAW_TOKEN = /(?<![\w$.%])user\s*\??\.\s*accessToken(?![\w$])/;

/** True when any {{ }} expression in `value` (any JSON) reads the raw access token. */
export function usesRawToken(value: unknown): boolean {
  let found = false;
  mapExpressions(value, (expr) => {
    if (RAW_TOKEN.test(expr)) found = true;
    return expr;
  });
  return found;
}

/** Why an element may not read the raw token (outside its query settings), or null. */
export function rawTokenProblem(
  node: { query?: unknown; children?: unknown },
  auth: AppAuthSettings
): string | null {
  if (tokenTags(auth).raw) return null;
  const { query: _query, children: _children, ...own } = node;
  return usesRawToken(own)
    ? "{{ user.accessToken }} reaches the page only with App Settings > Authentication > Expose the raw access token. Query settings and API calls get it from the server."
    : null;
}
