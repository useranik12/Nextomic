# Authentication for Built Apps

This is authentication for the END USERS of sites and apps built with Nextomic. It is separate from builder authentication (Better Auth, see `platform.md`). Never mix the two: builder users sign in to the builder; end users sign in to the built site.

Authentication actions must be usable from ANY element's action flow, not only from forms.

## 1. Provider model
App Settings > Authentication selects the provider for the project:

| Provider | Notes |
|---|---|
| None | No auth. Pages cannot require authentication; auth actions are hidden. |
| Supabase | Uses the project's Supabase connector. Provider toggles (Google, more later) live on the Supabase page. |
| Custom API | Maps each auth action to a call in API Data (REST). |

The Supabase page's Authentication card works only when the provider is Supabase. When it is not, show the card disabled with a link to App Settings.

```ts
interface AuthProvider {
  id: "supabase" | "rest";
  capabilities: {
    emailPassword: boolean;
    magicLink: boolean;
    otp: Array<"email" | "phone">;
    oauth: string[];            // e.g. ["google"]
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
- Refresh runs on the server (middleware or route) and on the client when needed. Failed refresh signs the user out and redirects to the Entry Page.
- Raw tokens are never rendered into HTML, never exposed in dynamic data, and never readable by custom HTML/JS elements. The `jwt` variable in API calls is resolved by the server only.

## 3. Dynamic data: User group
`User.isLoggedIn`, `User.id`, `User.email`, `User.phone`, `User.name`, `User.avatarUrl`, `User.role`, `User.metadata.<path>`, `User.claims.<path>`. Available in all content inputs, conditional visibility, conditions (themes, templates), and action params. In the editor, the "Preview as" control chooses Logged out or Logged in with a mock user (editable JSON that the owner writes; it is not fetched).

## 4. Route protection
- Page setting "Requires Authentication" (designed checkbox in page settings). Options when enabled: redirect target (default: the Entry Page), allowed roles (optional), preserve return path.
- App Settings > Authentication: Entry Page (where logged-out users land, for example Login), Logged In Page (where users land after sign in, for example Home), after-logout page.
- Public-only pages (for example Login) can enable "Redirect if logged in" to the Logged In Page.
- Enforcement: generated server middleware (Next.js middleware, Astro middleware) for SSR output, plus a client guard for static output. The return path (`?next=`) must be validated as a same-origin relative path to prevent open redirects.
- Role checks happen on the server for protected pages. Hiding elements by role is cosmetic only; document this in the UI next to the visibility setting.

## 5. Auth actions (action flow, "Authentication" category)
| Action | Params | Output |
|---|---|---|
| Sign up | email, password, optional user metadata | user |
| Sign in | email, password | user |
| Sign in with OAuth | provider, redirect after | none (redirects) |
| Send magic link | email, redirect | none |
| Send OTP | email or phone | none |
| Verify OTP | email or phone, code | user |
| Sign out | redirect after | none |
| Request password reset | email, redirect | none |
| Update password | new password | none |
| Update user | metadata fields | user |
| Refresh session | none | user |
| Get current user | none | user |
| Resend verification | email | none |

- Every action has onSuccess and onError branches. Outputs are available to later steps as dynamic data "Action outputs".
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
```ts
interface AppAuthSettings {
  provider: "none" | "supabase" | "rest";
  entryPageId?: string;
  loggedInPageId?: string;
  afterLogoutPageId?: string;
  sessionStorage: "cookie" | "local";
  passwordPolicy: { minLength: number; requireNumber: boolean; requireSymbol: boolean; requireMixedCase: boolean };
  requireEmailVerification: boolean;
  preventEnumeration: boolean;
  captchaOnAuth: boolean;
  oauth: { enabled: string[]; clientIds: Record<string, string> }; // client IDs are public values
  restMapping?: Record<string, { callId: string; variableMap: Record<string, string>; responseMap: Record<string, string> }>;
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
