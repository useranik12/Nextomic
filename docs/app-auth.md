# Authentication for Built Apps

This is authentication for the END USERS of sites and apps built with Nextomic. It is separate from builder authentication (Better Auth, see `platform.md`). Never mix the two: builder users sign in to the builder; end users sign in to the built site.

Authentication actions must be usable from ANY element's action flow, not only from forms.

## 1. Provider model

App Settings > Authentication selects the provider for the project:

| Provider   | Notes                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| None       | No auth. Pages cannot require authentication; auth actions are hidden.                                  |
| Supabase   | Uses the project's Supabase connector. Provider toggles (Google, more later) live on the Supabase page. |
| Custom API | Maps each auth action to a call in API Data (REST).                                                     |

The Supabase page's Authentication card works only when the provider is Supabase. When it is not (or authentication is off), its toggles show off and disabled with a note pointing to App Settings; the saved values are kept.

```ts
interface AuthProvider {
  id: "supabase" | "rest";
  capabilities: {
    emailPassword: boolean;
    magicLink: boolean;
    otp: Array<"email" | "phone">;
    oauth: string[]; // e.g. ["google"]
    resetPassword: boolean;
    updateUser: boolean;
    refresh: boolean;
  };
  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signInWithOAuth(input: { provider: string; redirectTo: string }): Promise<void>;
  sendMagicLink(input: { email: string; redirectTo: string }): Promise<void>;
  sendOtp(input: { email?: string; phone?: string }): Promise<void>;
  verifyOtp(input: { email?: string; phone?: string; code: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  requestPasswordReset(input: { email: string; redirectTo: string }): Promise<void>;
  updatePassword(input: { password: string }): Promise<void>;
  updateUser(input: { data: Record<string, unknown> }): Promise<AuthResult>;
  refreshSession(): Promise<AuthResult>;
  getUser(): Promise<AuthUser | null>;
  resendVerification(input: { email: string }): Promise<void>;
}
```

Verify method names and options against the current Supabase Auth docs before coding the Supabase provider.

### Custom API provider mapping

For each action the user picks an API Data call and maps variables and response fields:

- signIn, signUp, signOut, refresh, getUser, requestPasswordReset, updatePassword, verifyOtp.
- Response mapping: access token path, refresh token path, expiry path (or seconds), user object path.
- Header injection: `Authorization: Bearer [jwt]` (or another header) is added automatically to calls marked "Authenticated".
- Unmapped actions are hidden in the action picker.

## 2. Session handling in generated apps

- Default: tokens are stored in httpOnly, Secure, SameSite=Lax cookies set by generated server routes (Next.js route handlers, Astro endpoints). JavaScript in the page cannot read them. This also lets middleware guard routes on the server.
- Option for static-only sites: client-side storage (local storage). Show a warning in the UI that it is less secure.
- For Supabase, use the official server-side auth helper for the target framework where one exists (verify current docs). Do not hand-roll token refresh logic that the helper already provides.
- Session refresh is automatic (owner decision 2026-11-10): the generated app renews the session (middleware or server helper) before it expires; the action catalog has no refresh or get-user action, and the user is read through the User tags.
- Refresh runs on the server (middleware or route) and on the client when needed. Failed refresh signs the user out and redirects to the Entry Page.
- Raw tokens are never rendered into HTML, never exposed in dynamic data, and never readable by custom HTML/JS elements, with ONE exception: a project that turns on "Expose the raw access token to the page" (App Settings > Authentication, off by default, warning shown) gets `{{user.accessToken}}`. Even then, custom code elements never receive it. The `jwt` variable in API calls is resolved by the server only and remains the way to send the token (custom auth, Supabase, a Cloudflare Worker that checks the user).
- Server-run fields (owner decision 2026-11-09): query loop settings (Supabase filter values, REST call variables) and, from Phase 5, Supabase and server actions are filled on the server with `expressionScope(context, { server: true })`, so `{{ user.accessToken }}` works there whether or not the opt-in is on; the browser never sees it. Everything the page renders (text, attributes, styles, conditions, Other Loops rows) uses the page scope, where the token is empty unless the opt-in is on (`DynamicContext.exposeAccessToken`). The bolt offers the tag in server-run fields; elsewhere without the opt-in the Navigator marks the element (`rawTokenProblem`). The opt-in stays for debugging during development, with the warning to turn it off before production.
- Token claims: with "Keep token data as dynamic data" on, the server decodes the access token's payload (base64url; the signature is checked where the provider allows) from the session cookie on each request and after each refresh, and gives the page the claims as one JSON value. Claims are not secret, but the page cannot trust them: use them for display and conditions, never as proof. Servers check the token itself.

## 3. Dynamic data: User group

Built (2026-11-08): the bolt picker's **User** group offers `{{user.id}}` (uid), `{{user.email}}`, `{{user.phone}}`, `{{user.emailVerified}}` and `{{user.loggedIn}}`. Queries and API calls send the token themselves.

Token tags (2026-11-08, owner decision; only while authentication is on, see section 2):

- `{{user.jwt}}` (JSON), shown when "Keep token data as dynamic data" is on: every claim of the access token in one tag, read with dot notation, for example `{{user.jwt.sub}}`, `{{user.jwt.role}}`, `{{user.jwt.app_metadata.plan}}`, `{{user.jwt.exp}}`. Empty (`{}`) while signed out and in the editor.
- `{{ user.accessToken }}` (text), offered in server-run fields always and elsewhere only when "Expose the raw access token to the page" is on. Empty in the editor. The separate **Nextomic User** group is the BUILDER account (see `dynamic-data-and-actions.md`).

Planned: `User.isLoggedIn`, `User.id`, `User.email`, `User.phone`, `User.name`, `User.avatarUrl`, `User.role`, `User.metadata.<path>`, `User.claims.<path>`. Available in all content inputs, conditional visibility, conditions (themes, templates), and action params. In the editor, the "Preview as" control chooses Logged out or Logged in with a mock user (editable JSON that the owner writes; it is not fetched).

## 4. Route protection

- Page setting "Requires Authentication" (designed checkbox in page settings). Options when enabled: redirect target (default: the Entry Page), allowed roles (optional), preserve return path.
- App Settings > Authentication: Entry Page (where logged-out users land, for example Login), Logged In Page (where users land after sign in, for example Home), after-logout page.
- Public-only pages (for example Login) can enable "Redirect if logged in" to the Logged In Page.
- Enforcement: generated server middleware (Next.js middleware, Astro middleware) for SSR output, plus a client guard for static output. The return path (`?next=`) must be validated as a same-origin relative path to prevent open redirects.
- Role checks happen on the server for protected pages. Hiding elements by role is cosmetic only; document this in the UI next to the visibility setting.

## 5. Auth actions (action flow, "Authentication" category)

| Action                 | Params                                  | Output           |
| ---------------------- | --------------------------------------- | ---------------- |
| Sign up                | email, password, optional user metadata | user             |
| Sign in                | email, password                         | user             |
| Sign in with OAuth     | provider, redirect after                | none (redirects) |
| Send magic link        | email, redirect                         | none             |
| Send OTP               | email or phone                          | none             |
| Verify OTP             | email or phone, code                    | user             |
| Sign out               | redirect after                          | none             |
| Request password reset | email, redirect                         | none             |
| Update password        | new password                            | none             |
| Update user            | metadata fields                         | user             |
| Resend verification    | email                                   | none             |

- Failures are caught with a Try/Catch node around the action (the catch part reads the error); there are no per-action onSuccess/onError branches. Outputs reach later nodes through their output name (bolt: Actions group). The catalog lists these actions under Backend/CMS > Supabase Authentication; "Sign in", "Sign in with OAuth", "Send magic link" and "Send OTP" are the methods of one Login action (`packages/schema/src/actions/catalog-actions.ts`).
- Standard error codes: `invalid_credentials`, `user_exists`, `weak_password`, `email_not_verified`, `otp_invalid`, `otp_expired`, `rate_limited`, `network`, `unknown`. Messages are customizable per project and per action; the error object is available as dynamic data in onError.
- Prevent user enumeration is ON by default for password reset and magic link: the UI result is the same whether or not the account exists.
- When "Require captcha on auth" is on, the flow runs the Captcha validate step before sign in, sign up, reset, and OTP send.
- Auth actions work on any element: a Button can sign in with Google, a menu item can sign out, a Switch can update user metadata.

## 6. Forms

- The Form wrapper has a Submit action flow; it can start with any auth action. Fields map to action params by field `name` (`email`, `password`, `code`, `phone`, `name`) or by explicit binding.
- Auth form presets in the element picker (or snippet library): Login, Sign up, Forgot password, Reset password, Verify OTP (uses the Pin element), Magic link, Social sign-in buttons. Presets are normal elements and classes inserted into the page. They are fully editable and have no hidden behavior.
- Password inputs: masked by default, optional show/hide toggle, excluded from state persistence, previews, logs, and screenshots.
- Built-in validation presets: email format, password policy (min length, character rules), password confirmation match, OTP length.

## 7. Settings data

Built (2026-11-08) in project settings as `appAuth` (`packages/schema/src/app-auth.ts`), edited in App Settings > Authentication:

- `enabled` ("Use authentication"). Off: the provider is effectively None; "Requires Authentication" in page settings is disabled and pages are not protected.
- `requireByDefault` ("New pages require authentication"): a page created while this is on starts with Requires Authentication checked.
- `entryPageId` ("Login page"): never requires sign-in (its checkbox is disabled); signed-out visitors of protected pages go here; signed-in users are sent away from it.
- `loggedInPageId` ("After sign-in page"): where users go after sign-in when the action flow does not navigate.
- `provider`: `supabase` or `custom` (REST API and others); with `custom`, `userDataTypeId` picks the app data type that holds the user's data.
- `pageRequiresAuth(auth, page)` decides protection. Live sites serve a protected page only to a signed-in visitor (section 11).

The full planned shape:

```ts
interface AppAuthSettings {
  provider: "none" | "supabase" | "rest";
  entryPageId?: string;
  loggedInPageId?: string;
  afterLogoutPageId?: string;
  sessionStorage: "cookie" | "local";
  passwordPolicy: {
    minLength: number;
    requireNumber: boolean;
    requireSymbol: boolean;
    requireMixedCase: boolean;
  };
  requireEmailVerification: boolean;
  preventEnumeration: boolean;
  captchaOnAuth: boolean;
  oauth: { enabled: string[]; clientIds: Record<string, string> }; // client IDs are public values
  restMapping?: Record<
    string,
    { callId: string; variableMap: Record<string, string>; responseMap: Record<string, string> }
  >;
}
```

Secrets (OAuth client secrets, service keys) are never stored here. Supabase handles its own OAuth secrets in the Supabase dashboard; the builder stores only public client IDs.

## 8. Builder preview

- Preview uses a mock user for protected pages and conditions.
- Real auth calls from the editor preview go through the builder proxy to the connected provider and require the dry-run toggle to be off. OAuth redirects can only be fully tested on a published or preview domain; say so in the UI.

## 9. Tests

Provider contract tests (Supabase against a test instance, REST against a mock), route guard (server and client), open redirect prevention, session cookie flags, token never present in HTML or dynamic data, enumeration protection, captcha gate, password field exclusion from state and logs, auth form presets end to end (login, sign up, reset, OTP).

## 10. Out of scope for now

Passkeys and multi-factor authentication for built-app users, Firebase, Auth0, Clerk, and other providers. Keep `AuthProvider` open for extension.

## 11. Built-app auth runtime (Phase 5d-1, Supabase provider)

Built 2026-11-12. Hand-rolled over Supabase Auth's (GoTrue) REST API with the project's anon key, in `packages/integrations/src/supabase/auth.ts` (no `@supabase/*` package, so the platform keeps the "no Supabase imports" rule; recorded in the decisions log). The connector runs it as the resource `auth:session`; tokens never leave the server.

- **Session cookie.** `nxs_l_<projectId>` on the live site, `nxs_p_<projectId>` in the owner preview (apart, so signing in on one never signs in the other). `HttpOnly`, `SameSite=Lax`, `Path=/` (it must reach both `/site/<id>/...` and `/api/site/<id>/...`), `Secure` when the request is https, 30 days. The value is the access token, the refresh token and the expiry; a session that does not fit a cookie (about 3.8 kb) is refused with a message. The page never sees it; `{{ user.accessToken }}` stays gated by the App Settings opt-in.
- **Every token is checked.** A made-up cookie signs nobody in: the server asks Supabase `GET /auth/v1/user` with the token (cached 30 seconds per token) and builds `{{ user.* }}` from that answer. A failed check, or Supabase being unreachable, shows the visitor as signed out.
- **Renewal.** An access token with under 30 seconds left is renewed with the refresh token. Where cookies can be written (the action, fragment and loop endpoints) the endpoint renews before it reads the request; a server-rendered page cannot write cookies, so it redirects to `/api/site/<id>/auth/refresh?next=...`, which renews, sets the cookie and redirects back (a renewed session that still fails the check is dropped, so it cannot loop). Refresh tokens are single use: parallel requests share one renewal per token. A session that cannot be renewed is cleared.
- **Row Level Security sees the visitor.** Supabase requests of a signed-in visitor (queries, loops, row actions, RPC) send their access token as the bearer (the `apikey` stays the anon key), and API Data calls get it as `jwt`. Signed out, everything runs as anon.
- **Protected pages (section 4).** `getPublishedView` returns a protected page only to callers that pass `includeProtected` and then check the visitor (`gatedView`). The page redirects a signed-out visitor to the login page with `?next=<path>` (404 when no login page is chosen), renews an expired session first, and sends a signed-in visitor away from the login page to the after-sign-in page. The fragment, loop and action endpoints answer 404 for a protected page without a valid session. Roles are not built yet (page "allowed roles" comes later). The owner preview does not guard (the owner sees every page).
- **Redirect flows.** OAuth, magic link, password reset and sign-up confirmation use PKCE: the server makes a verifier (kept in `nxv_<l|p>_<projectId>`, `HttpOnly`, 10 minutes, path `/api/site/<id>/auth` only) and gives Supabase the S256 challenge. Supabase returns the visitor to **`<site origin>/api/site/<id>/auth/callback`** with a `code`; the route exchanges it for a session (`grant_type=pkce`), sets the cookie and redirects to the saved `next` path, else the after-sign-in page. A failure redirects to the login page with `?auth_error=<code>`. **That one address must be in the Supabase project's redirect allow-list** (Authentication > URL Configuration). Every redirect is a same-site path (`safePath`: no scheme, host, `//` or backslash).
- **After a sign-in action.** Login, Verify One-Time Code and Register store the session; when the flow ends and nothing else navigated, the page goes to `?next=` (the path a protected page remembered), else the After sign-in page, else reloads. Log Out clears the cookie and goes to its Redirect after, else reloads. OAuth leaves for the provider at once. Magic link, code, reset and resend only send mail and answer nothing.
- **Standard errors.** The catch part reads `{ code, message }` with `invalid_credentials`, `user_exists`, `weak_password`, `email_not_verified`, `otp_invalid`, `otp_expired`, `rate_limited`, `not_signed_in` or `unknown`; messages come from Supabase (never a body dump). Password reset and magic link answer the same for unknown accounts (Supabase does).
- **Needs.** Authentication on and provider Supabase with the connector saved; otherwise the action fails with a message saying what to turn on. The Custom API provider mapping is not built; its actions fail with that message.
- **Not built yet:** CAPTCHA, roles on pages, `User.claims` beyond `{{ user.jwt }}`, local-storage sessions for static output, Test in the flow editor (it logs what would run; use Preview).
