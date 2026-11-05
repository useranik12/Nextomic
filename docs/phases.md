# Build Phases

Work one phase at a time. Do not start the next until approved. Reorder only with my approval.
Platform = own Postgres + Better Auth. Supabase and REST are integrations for built apps only.
Read the docs named in each phase before starting it.

## Phase 0: Foundation

Docs: `spec.md`, `ui-reference.md`, `platform.md`

- [ ] Bun workspaces monorepo (apps/editor, packages: schema, renderer, css-framework, runtime, db, integrations, storage)
- [ ] TypeScript strict, ESLint, Prettier, Husky pre-commit, CI on Bun and Node
- [ ] HeroUI + Tailwind wired to `blueprint/tokens.json` (dark-first, light supported); builder color mode as a user setting (Settings > Appearance)
- [ ] Builder icons: `Icon` wrapper over locally bundled Iconify sets with a typed registry, lint for unused or unregistered icons, Material fallback flagged, `assets/icons/LICENSES.md`
- [ ] Asset registry with brand assets from `assets/brandings`
- [ ] Postgres + Drizzle, first migration, `.env.example`
- [ ] Better Auth: signup/login/logout, sessions, email verification, reset; admin setting to allow/disallow signup
- [ ] Workspaces and basic roles (owner, admin, member)
- [ ] Storage adapter (local first, S3-compatible ready)
- [ ] Dashboard shell and All Projects from the designs (header, nav, search, date range, grid/list, New Project, card menu); the Dashboard body stays an empty state until Phase 13
- [ ] `bun run deps:manifest` generates `builder-dependencies.json`; CI fails if outdated; read-only view in Settings
- [ ] Docker (Bun) + Dokploy config (app + Postgres)
- [ ] Record Next.js-on-Bun verification result in `docs/spec.md`

## Phase 1: Core editor (ends with a walking skeleton)

Docs: `ui-reference.md`, `elements.md`, `design-system.md` (sections 1 to 4), `templates-and-themes.md` (pages)

- [ ] Schema v1: project, page, element node, breakpoints, conditions model (`docs/schema.md` generated)
- [ ] Editor shell per `ui-reference.md` 4.3: top bar (logo back to projects, page select, add page, Page Settings dialog shell, site dark/light view switch, editing chip, breakpoint switcher with manager menu, view published icon, publish menu with Save and Preview only until Phase 11), left rail (Navigator, State Management, Media, Supabase, API Data, Design System, Custom Codes, Git Connection, Version History, App Settings), Elements flyout, canvas (sandboxed iframe), right panel
- [ ] Navigator tree (page or template elements only), selection, drag/drop, reorder, nesting, duplicate, delete, copy/paste
- [ ] Right panel with nothing selected: Page Parameters, Route Settings (including the "Requires Authentication" flag, stored only), Page State Variables. With an element selected: Element / Design / Action tabs and "Search settings"
- [ ] Breakpoints: user-defined (defaults desktop, tablet, mobile), manager menu (add, edit, delete, reorder, zoom, rotate), cascade rules, change-dot indicators for every breakpoint
- [ ] Undo/redo, autosave with version number (conflict dialog), Version History basics
- [ ] Component registry with `bindable` flags + starter elements: section, container, heading, text, button, image
- [ ] Element IDs (`nxtomc-xxxxxxxx`) and project setting toggle
- [ ] Save/load pages, page list, routing
- [ ] Walking skeleton: preview route renders a saved page through `packages/renderer`
- [ ] Tests: schema, store, registry, renderer

## Phase 2: Design system and themes

Docs: `design-system.md`, `templates-and-themes.md` (sections 1 to 3)

- [ ] Style data model (StyleMap) and full Design tab groups
- [ ] Classes: create, add to element, active-target editing, class manager (folders, usage, rename, delete/replace)
- [ ] Bidirectional CSS editor with round-trip tests
- [ ] Variables manager, fluid typography, spacing scale, color palettes
- [ ] Themes: multiple per project, conditions (static first), priority, default, per-theme variables and element defaults, forced theme per page
- [ ] Color modes (light/dark/custom), runtime switching without flash, preview through the top bar moon/sun switch
- [ ] Design System page, Fonts & Icons tab, Fonts sub-tab (`fonts-and-icons.md` sections 1 and 2): Google Fonts and Fontsource import, upload, self-hosting, variable fonts, roles to font variables, licenses, usage-blocked removal
- [ ] `packages/css-framework` with built-in element default classes; import another framework
- [ ] Custom CSS files (order, scope, validation)
- [ ] Pre-built animations and GSAP visual editor; reusable named animations
- [ ] Output CSS generation: base plus per-theme CSS, unused-class pruning
- [ ] Tests: theme resolution, CSS scoping, round trip

## Phase 3: Templates v1 (header, footer, 404)

Docs: `templates-and-themes.md` (sections 2, 4.1 to 4.4)

- [ ] Templates in the page select (Pages and Templates groups, "New template"), template editing in the same canvas with the template editing chip, Page Settings template section
- [ ] Header and footer templates with conditions, priority, per-page opt-out or override
- [ ] 404 template (one default; generated fallback if none)
- [ ] "Why is this applied?" explanation in the editor
- [ ] Layout composition in renderer output for Next.js and Astro
- [ ] Tests: resolution, opt-out, 404 output

## Phase 4: Data layer

Docs: `dynamic-data-and-actions.md`, `integrations.md`, `ui-reference.md` (Supabase, API Data), `elements.md` (universal dynamic data)

- [ ] State Management page with App State and Constants tabs (table pattern of API Data Variables; owner approves the first build), all data types, app state persistence (local storage or cookie, cleared on logout unless "Keep after logout"), page state variables in the right panel
- [ ] Supabase page and API Data page from the designs; schema fetch saves structure only
- [ ] Connector secrets encryption and server proxy with SSRF protection
- [ ] Queries (page, element/loop, action-triggered), parameters, loading/empty/error states
- [ ] Dynamic data modal (bolt icon): groups, scope rules, dot notation, live preview on canvas, type-aware
- [ ] Universal bindability: every registered prop, attribute, style value, class toggle, SEO and route field accepts dynamic tokens
- [ ] Loops on div-based elements with auto-duplicated children
- [ ] Transforms (type conversion) and date/time formatting presets
- [ ] Conditional visibility; runtime condition operands for themes and templates
- [ ] Tests: scope validation, loops, transforms, bindings everywhere, connectors

## Phase 5: Actions

Docs: `dynamic-data-and-actions.md` (section 8), `ui-reference.md` (4.8)

- [ ] Action flow editor modal replicating the FlutterFlow structure with Nextomic styling (triggers list, flow canvas, Define Action panel, error badge)
- [ ] `packages/runtime` client runtime (tree-shakable)
- [ ] Core actions: queries, state, navigation, element manipulation, class/ID actions, wait, conditions, parallel
- [ ] Form actions, media actions, animation actions, color mode actions, device actions (vibrate presets, share, pick datetime, toast)
- [ ] Server actions: send email, webhook, bucket upload, custom function (generated server handlers; secrets in env only)
- [ ] Tests: flows, success/error paths, no secret leakage

## Phase 6: Media and assets

Docs: `ui-reference.md` (4.6), `elements.md` (Icon, SVG, Image, Video, Audio)

- [ ] Media page replicating the Instatic structure with Nextomic styling (library filters, folders, trash, upload, search, type tabs, sort, grid/list, details drawer, bulk actions)
- [ ] Asset picker used by Image, Video, Audio, Icon, SVG elements
- [ ] Fonts & Icons tab, Icons sub-tab (`fonts-and-icons.md` section 3): catalog of popular free libraries, SVG and icon-font output modes, custom imports (IcoMoon, Fontello, generic icon font, SVG upload, Iconify JSON), license and attribution handling, icon picker
- [ ] Image optimization, alt text checks, SVG sanitization, usage tracking
- [ ] Tests: upload validation, usage, sanitization

## Phase 7: Element library

Docs: `elements.md`

- [ ] Forms group (inputs with clear, mask/toggle, regex and built-in validation)
- [ ] General group (accordion, tabs, dropdown, off-canvas, list, icon list, divider, progress, rating, switch, counter)
- [ ] Rich text, code block, HTML, SVG, video, audio, icon
- [ ] Slider, chart, map, captcha (Turnstile, Google)
- [ ] Query group (filter, search, pagination, query-bound form controls)
- [ ] Per-element tests: schema, editor render, Next and Astro render, a11y, dynamic data on every bindable prop

## Phase 8: Authentication for built apps

Docs: `app-auth.md`, `integrations.md`

- [ ] App Settings > Authentication (provider, entry page, logged-in page, session mode, password policy)
- [ ] Supabase provider (email/password, magic link, OTP, Google OAuth) and Custom API provider (mapped to API Data calls)
- [ ] User dynamic data group, "Preview as" mock user
- [ ] Auth actions on every element; error codes; outputs
- [ ] Route protection: "Requires Authentication", redirects, roles, server middleware, safe `next`
- [ ] Auth form presets (login, sign up, forgot, reset, OTP, magic link, social)
- [ ] Captcha gate, enumeration protection
- [ ] Tests: provider contracts, guards, cookie flags, token never in HTML or dynamic data

## Phase 9: Advanced templates

Docs: `templates-and-themes.md` (sections 4.5, 4.6)

- [ ] Popup templates with triggers, frequency, accessibility, Open/Close popup actions
- [ ] Archive, single, and search-results templates bound to queries and route params; pagination in URL
- [ ] 500 error template
- [ ] Rendering modes (static, server, revalidate) and static params generation; record defaults in `spec.md`
- [ ] Tests: popups, archive pagination, single param binding

## Phase 10: Dependencies and custom code

Docs: `dependencies.md`

- [ ] `project_dependencies` table and `core-dependencies.json`
- [ ] Project Settings > Dependencies: Built-in (locked), Integrations (toggles), Custom (add, version, remove)
- [ ] npm registry search/validation; pinned versions and integrity hashes
- [ ] Isolated build container (scripts disabled, no builder env/DB, registry-only network, limits)
- [ ] Custom Codes page: custom CSS files, custom JS, custom components, custom actions, init snippets; sandboxed preview
- [ ] Audit on build; admin denylist/allowlist; security tests

## Phase 11: Publish, export, import, GitHub

Docs: `platform.md`

- [ ] Next.js output and Astro output (themes, templates, auth guards, popups included)
- [ ] SEO fields, sitemap, robots, OG image
- [ ] Publish menu wired: Publish update (whole project, check dialog first), Save snapshot, Preview draft, Revert to published, Unpublish; view published page icon
- [ ] Export: zip, local server storage, S3-compatible; `.env.example`, README, Dockerfile; fonts, icons, license and attribution files
- [ ] Project package `.nextomic.zip` and re-import of exported sites (migrations for older formats)
- [ ] Git Connection page: GitHub push (OAuth/token, repo/branch, auto-push, PR mode)
- [ ] Domains and Dokploy deploy option

## Phase 12: Platform administration

Docs: `platform.md`

- [ ] App Settings sections not built earlier (see the mapping table in `platform.md`)
- [ ] Social sign-in (Google first) and passkeys for builder users
- [ ] Rate limiting settings, optional 2FA, domain/IP allowlists
- [ ] Project members and role matrix; invitations; audit log
- [ ] Multiple SMTP accounts, test send, default and per-project selection, email templates
- [ ] Automatic backups (local zip, S3), retention, restore with dry run
- [ ] Admin dashboard: backup status, failures, health

## Phase 13: Dashboard, polish, and starter templates

- [ ] Dashboard body (`ui-reference.md` 4.1): short design proposal approved by the owner first, then KPI cards, usage charts, storage breakdown, recent projects, activity feed, integrations overview, admin health; daily rollup table
- [ ] Starter project templates built from Figma pages
- [ ] Keyboard shortcuts, command palette
- [ ] Performance pass, accessibility pass, e2e suite
- [ ] Production hardening: monitoring, error reporting, docs site

## Phase 14: Reusable components (deferred)

Do not start until every phase above is approved. The schema reserves `componentInstance`. Scope (props, slots, variants, instances, overrides, library) will be written then.
