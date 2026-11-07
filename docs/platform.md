# Platform Spec

Settings for the builder itself (admin) and for each project. Platform runs on its own Postgres + Better Auth. Runtime: Bun primary, Node LTS supported.

Builder authentication (this doc) is for people who use the builder. Authentication for the end users of built sites is a different system: see `app-auth.md`. Do not share tables, sessions, or code between them.

## 1. Auth (Better Auth)

- Email + password with email verification and password reset.
- Social sign-in: Google first; others (GitHub, Microsoft, etc.) via the same provider config.
- Passkeys (WebAuthn) as sign-in and as a second factor option.
- Admin setting: allow or disallow public signup. When disabled, users join by invite only. First user becomes owner on a fresh install.
- Sessions: secure, httpOnly cookies, configurable expiry, list/revoke sessions.
- Use Better Auth's own plugins for passkey, organization/roles, and rate limiting. Verify plugin names and options against the current Better Auth docs before coding.

## 2. Roles and project members

- Workspace roles: owner, admin, member. Project roles: owner, editor, designer, content editor, viewer.
- Permission matrix is code (a typed map), enforced on every server route and action. Never rely on UI hiding.
- Project settings > Members: invite by email (link expires), change role, remove, transfer ownership.
- Multiple users on a project: presence indicators first; element-level locking or live co-editing is a later phase. Until then, use optimistic concurrency (version number on page saves) with conflict dialogs.
- Audit log: logins, role changes, publish, export, backups, settings changes.

## 3. Security settings

- Login rate limiting (per IP and per account), configurable attempts/window/lockout. Signup and password-reset limits too.
- Optional 2FA (TOTP) and passkey enforcement for admins.
- Allowed email domains for signup, IP allowlist for admin (optional).
- Secrets encrypted at rest (see `integrations.md`). Security headers, CSRF protection, CSP for the editor.
- Custom HTML/JS elements and custom code run in the sandboxed canvas iframe in the editor.

## 4. SMTP (environment only)

Owner decision (2026-11-08): there are no SMTP settings in the builder. SMTP lives only in Docker Compose / Dokploy variables.

- The builder sends its own email (sign-up verification, password reset, later invites) with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`. `SMTP_SECURE=true` (or port 465) connects with TLS; otherwise STARTTLS is used when the server offers it.
- Built and exported apps also read SMTP from their own environment variables at deploy time (the "send email" action in Phase 5). Exports include `.env.example` with the `SMTP_*` names and never embed credentials. No per-project SMTP selection exists.
- Sending goes through a queue (`email_queue` table): messages are sent right away and by a worker every 15 seconds (`instrumentation.ts`). Up to 5 attempts, waiting 30 s, 2 min, 10 min, 30 min. Rows stuck in "sending" for 5 minutes return to the queue. Bodies are cleared once a message is sent or gives up; no message content is kept.
- Templates (verify email, reset password) are built in (`server/mail/templates.ts`), with `{{name}}`, `{{email}}`, `{{url}}`, `{{appName}}`; values are HTML-escaped in the HTML part.
- Email verification is required only when `SMTP_HOST` is set at server start, so a fresh deploy can register its first user.
- Files: `server/mail/{accounts,transport,templates,queue,worker}.ts`, `lib/mail.ts`.

## 5. Backups

- Automatic scheduled backups of: projects (JSON + assets), builder settings, design systems.
- Schedule (daily/weekly), retention count, encryption option.
- Targets: local storage (zip on the server volume) and S3-compatible storage (AWS S3, R2, MinIO, etc.).
- Manual backup and one-click restore (full or per project). Restore validates the manifest and version, and offers dry run.
- Backup status and failures surfaced in the dashboard and by email.

## 6. Export and import

- **Project package** `.nextomic.zip`: `manifest.json` (format version, builder version, checksums), `project.json`, pages, templates, classes, variables, themes (with color modes and conditions), queries (schema structure only), connectors (secrets excluded), auth settings (no secrets), assets, custom CSS/code, dependency list.
- **Site export:** a standalone Next.js or Astro project that builds and runs anywhere (no Nextomic server needed). Includes themes, templates, route guards, and auth server routes, `nextomic/project.json` so the builder can re-import and edit it, `.env.example`, README with run/deploy steps, and a Dockerfile.
- Export destinations: download zip, local server storage, S3-compatible bucket.
- Import: from `.nextomic.zip` or an exported site folder/zip. Validate against the schema, migrate older format versions, report conflicts (name collisions), and never execute imported code during import.
- **GitHub push:** connect GitHub (OAuth app or fine-grained token), choose repo and branch, push the exported site, optional auto-push on publish. Store tokens encrypted. Support PR mode.

## 7. App Settings (per project)

Opened from the bottom of the editor's left rail. Replicates the FlutterFlow structure (`blueprint/inspiration/flutterflow-app-settings.png`) with Nextomic styling and these sections. A search field at the top filters sections.

| Group         | Nextomic section               | Notes                                                                                                                                                                                                                                                                                                                            | Phase   |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| General       | App Details                    | Project name and description, display name, current environment (production/staging), initial pages (Entry Page, Logged In Page), routing options, "Generate element ID automatically"                                                                                                                                           | 1 and 8 |
| General       | Version control                | BUILT (in the App Settings panel): one switch for version history of the whole app. Off: no snapshots for any page and the per-page switch and limit in Page Settings are disabled. The limit lives only in Page Settings (5 to 200, default 200), with a per-page switch. At the limit the oldest versions are deleted on save. |
| General       | Hide edit border while editing | BUILT: hides the selected element's outline while its Border settings are open in the Design tab. Off by default.                                                                                                                                                                                                                |
| General       | App Assets                     | Favicon, app icons, OG image, brand files (from Media), shortcut to Design System > Fonts & Icons (`fonts-and-icons.md`)                                                                                                                                                                                                         | 6       |
| General       | SEO and Meta                   | Site title template, meta defaults, robots, sitemap                                                                                                                                                                                                                                                                              | 11      |
| General       | Languages                      | Default locale and extra locales; feeds the locale condition                                                                                                                                                                                                                                                                     | 12      |
| Project Setup | Collaboration                  | Project members and roles (see section 2)                                                                                                                                                                                                                                                                                        | 12      |
| Project Setup | Platforms and Domains          | Web deployment targets, custom domains, Dokploy deploy option                                                                                                                                                                                                                                                                    | 11      |
| Project Setup | Project Dependencies           | See `dependencies.md`                                                                                                                                                                                                                                                                                                            | 10      |
| Project Setup | Environments                   | Env var names and per-environment values (encrypted), `.env.example` generation                                                                                                                                                                                                                                                  | 11      |
| App Settings  | Authentication                 | Provider, entry/logged-in pages, session storage, password policy (see `app-auth.md`)                                                                                                                                                                                                                                            | 8       |
| App Settings  | Email (SMTP)                   | Choose which SMTP account the project's "send email" action uses (see section 4)                                                                                                                                                                                                                                                 | 12      |
| App Settings  | Backups                        | Per-project override of backup schedule and target                                                                                                                                                                                                                                                                               | 12      |
| App Settings  | Web Deployment and Export      | Export zip/S3, GitHub push, deploy settings                                                                                                                                                                                                                                                                                      | 11      |
| App Settings  | Danger Zone                    | Delete project with confirmation                                                                                                                                                                                                                                                                                                 | 12      |

Not carried over from FlutterFlow: Firebase, Mobile Deployment, Walkthroughs, Publish as Library (not in scope).

Left rail pages that sit outside App Settings:

- **Version History:** snapshots on every manual save and publish plus periodic autosave snapshots; restore, compare (JSON diff summary), and name a snapshot. Page design is not provided; ask before building.
- **Git Connection:** connect GitHub, choose repo and branch, push now, auto-push on publish, PR mode (see section 6). Page design is not provided; ask before building.
- **Custom Codes:** custom CSS files, custom JS, custom components and actions (see `dependencies.md` and `design-system.md`). Page design is not provided; ask before building.
- **Design System:** classes, variables, themes, color modes, custom CSS files (see `design-system.md` and `templates-and-themes.md`). Page design is not provided; ask before building.

## 8. Operations

- Config via env vars; `.env.example` documented. Health endpoint. Structured logs.
- Docker image (Bun) and Dokploy deployment config; Postgres volume and backup volume documented.
- DB migrations run on boot or via explicit command, never destructive without a backup.

## 9. Dashboard and projects

- Dashboard and All Projects are specified in `ui-reference.md` (4.1, 4.2). Projects belong to a workspace; the All Projects header shows the workspace name. The dashboard body (KPIs, charts, activity, health) is designed in-house, approved by the owner, and built last. It reads from a daily rollup table in the builder's Postgres (`usage_daily`: workspace, project, date, edits, publishes, storage bytes) and has no visitor analytics.
- User preferences (Settings > Appearance): builder UI color mode (dark default, light, system).
- Project list supports search, date range (by last modified), grid/list view, and the card menu (rename, duplicate, export, backup now, settings, delete).
- Project thumbnails are generated from the home page on publish or save (server-side screenshot in an isolated worker; never executes custom code in the builder process).

## 10. Tests

Auth flows (signup disabled/enabled, social mocks, passkey flow where testable), permission matrix, rate limits, SMTP with a mock server, backup and restore round trip, export/import round trip including themes, templates, and auth settings, GitHub push with a mock.
