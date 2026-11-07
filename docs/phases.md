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

- [x] Schema v1: project, page, element node, breakpoints, conditions model (`docs/schema.md` generated)
- [x] Editor shell per `ui-reference.md` 4.3: top bar (logo back to projects, page select, add page, Page Settings dialog shell, site dark/light view switch, editing chip, breakpoint switcher with manager menu, view published icon, publish menu with Save and Preview only until Phase 11), left rail (Navigator, State Management, Media, Supabase, API Data, Design System, Custom Codes, Git Connection, Version History, App Settings), Elements flyout, canvas (sandboxed iframe), right panel _Built: all items, including the editing chip popover, canvas zoom (wheel, buttons, Fit, 100%), middle-button hold-drag pan, device rotate, dragging element tiles and tree rows onto the canvas, Page Settings General/SEO/Language, Duplicate page, one home page per project, and Pages/Templates groups in the page select (Templates group is empty until Phase 3). Also built: auto-ordered breakpoints, classes and ID field, dynamic bolt on Element fields, App Settings (element ID toggle), joined Publish/Unpublish with a public /site route, HeroUI Select dropdowns, Page Parameters value field. Not built: the full Design tab (Phase 2)._
- [x] Navigator tree (page or template elements only), selection, drag/drop, reorder, nesting, duplicate, delete, copy/paste _Copy and paste use Ctrl/Cmd+C and V and the Paste button in the element header; Elements tiles insert by click or by dragging into the tree (dragging onto the canvas is not built)._
- [x] Right panel with nothing selected: Page Parameters, Route Settings (including the "Requires Authentication" flag, stored only), Page State Variables. With an element selected: Element / Design / Action tabs and "Search settings"
- [ ] Breakpoints: user-defined (defaults desktop, tablet, mobile), manager menu (add, edit, delete, reorder, zoom, rotate), cascade rules, change-dot indicators for every breakpoint _Built: manager modal (add, edit, delete with move/discard, reorder, reset), cascade, change dots. Remaining: canvas zoom and rotate._
- [x] Undo/redo, autosave with version number (conflict dialog), Version History basics
- [x] Component registry with `bindable` flags + starter elements: section, container, heading, text, button, image _Next render only; the Astro render joins the exporter phase._
- [x] Element IDs (`nxtomc-xxxxxxxx`) and project setting toggle
- [x] Save/load pages, page list, routing
- [x] Walking skeleton: preview route renders a saved page through `packages/renderer`
- [x] Tests: schema, store, registry, renderer

## Phase 2: Design system and themes

Docs: `design-system.md`, `templates-and-themes.md` (sections 1 to 3)

- [x] Style data model (StyleMap) and full Design tab groups _Groups: layout, spacing, size, typography, background, border, position, effects._
- [x] Classes: create, add to element, active-target editing, class manager (categories, usage, rename, delete/replace) _Built: create, duplicate, rename and delete with replacement (also updates other saved pages), usage counts, search, filter by usage (used, unused, locked, without styles), categories, bulk delete, convert element styles to a class (CSS section of the Design tab), export and import of classes as a CSS file (`class-import.ts`), virtualized class list (`components/ui/virtual-list.tsx`)._
- [x] Bidirectional CSS editor with round-trip tests _Built: `packages/schema/src/css-text.ts` (PostCSS), CSS section in the Design tab, `raw` kept and emitted. Class manager UI and variables come next._
- [x] Variables manager, fluid typography, spacing scale, color palettes _Built: Design System modal (Variables, Typography, Spacing, Colors, Classes), `variables` in project settings, `--nxt-*` output on canvas, preview and published site, variable picker in Design fields, rename with reference update. Import/export of variables is open._
- [x] Themes: multiple per project, conditions (static first), priority, default, per-theme variables, forced theme per page _Built: `theme.ts` schema and resolver, Themes tab in the Design System modal, Page Settings theme select, per-theme variable CSS on canvas, preview and site. Custom color modes (up to 6 per theme, add/rename/remove in the Themes tab, top bar mode picker when more than two). Open: element defaults per theme, per-theme fonts and custom CSS, theme import/export, runtime conditions._
- [x] Color modes (light/dark/custom), runtime switching without flash, preview through the top bar moon/sun switch _Built: light and dark per theme, custom modes UI, boot script without flash, top bar preview and mode menu, default mode and system preference. Open: visitor-facing switch action (Phase 5)._
- [x] Design System page, Fonts & Icons tab, Fonts sub-tab (`fonts-and-icons.md` sections 1 and 2) _Built: Google Fonts catalog (fetched through Fontsource, self-hosted in project storage), weight/italic/subset choice, variable fonts (wght axis), upload of woff2/woff/ttf/otf with rights checkbox and magic-byte check, active toggle, preload, `@font-face` with `unicode-range` on canvas, preview and published site, roles to `--nxt-font-heading|body|mono`, page-weight warning, usage-blocked removal, font picker beside Font family in Design. Open: woff2 conversion of ttf/otf, size-adjusted fallback face, font table parsing on upload, "Replace with..." on removal, per-theme font choice, purge of unused files, Icons sub-tab (Phase 6)._
- [x] Theme CSS frameworks (`design-system.md` section 7) _Built: Main framework per new project, per-theme framework, import/export of CSS files, scale controls (minor/major ratio, base index and size, screens) that also work on imported frameworks, Framework tab (variables, scales, classes), framework variables in pickers. Open: `packages/css-framework` element default classes, auto-adding used classes, class pruning on publish._
- [x] Design System managers in the Bricks and Core Framework style, with draft + Save _Built: Colors (palettes, prefix, picker with Hex/RGB/HSL/CSS and alpha), Typography and Spacing scales, Variables manager with categories, Classes manager with categories, lock, usage, Fonts manager and font editor with variations and favorites, Save button in the modal header with Save/Discard prompt._
- [x] Custom CSS files (order, scope, validation) _Built: `css-files.ts` schema, `ProjectSettings.cssFiles`, Custom CSS tab in the Design System (order, enable, global or chosen pages, minify on publish, syntax check), layer after the theme in canvas, preview and site output; a file with a syntax error is skipped._
- [x] GSAP visual editor _Built: Animations editor (folders, timelines, animation bars with drag and resize, transport and canvas preview, Timeline, Animation and GSAP Code tabs, ScrollTrigger, split text, stagger, custom vars, import and export), runtime player on preview and published pages. Open: pre-built presets, reusable named animations for action flows, reduced-motion._
- [x] Output CSS generation: base plus per-theme CSS, unused-class pruning _Built: published site links one theme file per theme (`/theme-css/<projectId>/<slug>.css?v=<publishedAt>`, public, immutable cache, pruned to classes used by published pages); preview keeps inline CSS; layered output (fonts, variables, theme framework and variables, classes, elements) and unused framework class pruning for preview and the published site (`css-prune.ts`, renderer `pruneUnusedClasses` and `keepClasses`). Open: pruning of user classes once templates and actions can add classes._
- [x] Tests: theme resolution, CSS scoping, round trip

## Phase 3: Templates v1 (header, footer, 404)

Docs: `templates-and-themes.md` (sections 2, 4.1 to 4.7)

- [x] Templates in the page select (Pages and Templates groups, New page or New template), template editing in the same canvas with the Template chip and a secondary-colored top bar line _Built: `templates` table, `server/templates.ts`, `open-item.ts`, store `kind`, Template options in the right panel (published, priority, theme, conditions, marking)._
- [x] Pages & Templates manager (left rail), screenshots, categories and tags _Built: `components/editor/library/*`, `marking-group.tsx`, App Settings > Generate Screenshots, `/api/screenshots`. Open: bulk actions._
- [x] Header and footer templates with rules, priority, per-page choice (Auto, None, specific) _Built: `rules.ts`, `template.ts`, `compose.ts`, Page Settings > Header and footer._
- [x] 404 template (best published one; a plain default until one exists, status 404) _Built: `site/[id]/not-found.tsx`, `middleware.ts`._
- [x] "Why is this applied?" in the editing chip popover
- [x] Layout composition in the preview and published site (header, main, footer, skip link) _Next output only; the Astro output joins the exporter phase._
- [x] Dynamic data groups: page and template properties (with status), categories, tags
- [x] Tests: rules, resolution, opt-out, composition, 404, manager filters; e2e for manager, marking, header on the site, default 404, screenshots
- [x] Follow-up fixes: nested groups, Whole site and Excluding, wrapping searchable field picker, stacked rule layout, header and footer in the editing canvas, Page Settings without header and footer choice, sticky header settings with runtime, Draft/Published/Scheduled status with date and time picker (replaces include in publish), dynamic bolt on page SEO and description fields with tags resolved in page metadata, compact settings fields, margin/padding/border value tools beside each side, screenshot fallbacks with a visible reason
- [x] Follow-up 2: Template settings modal (sidebar keeps Categories and tags), bolt on page and template names, screenshots survive images with no address, light and dark only (custom color modes removed), theme conditions on rules, Format button (Prettier, loaded on demand) on every code box, Custom CSS tab spacing
- [ ] Open: `Preview as...` menu on the chip, browser-only rules, user fields until auth, time zone setting for date rules

## Phase 4: Data layer

Docs: `dynamic-data-and-actions.md`, `integrations.md`, `ui-reference.md` (Supabase, API Data), `elements.md` (universal dynamic data)

- [x] State Management page with App State and Constants tabs (table pattern of API Data Variables; owner approves the first build), all data types, app state persistence (local storage or cookie, cleared on logout unless "Keep after logout"), page state variables in the right panel _Built: `schema/state.ts`, `state-usage.ts`, `components/editor/state/*`, `runtime/persisted-state.ts`, `{{app.x}}`/`{{const.x}}` tags. Persistence is wired into the site with Phase 5 actions; awaiting owner approval of the screen._
- [x] Data Types page (Custom Data Types and ENUM), the unified type list, n8n-style `{{ }}` expressions with a suggestion panel _Built: `schema/expression/*`, `components/editor/data-types/*`, `components/editor/expression/*`; awaiting owner approval of the screens. Supabase Row becomes selectable in 4d._
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
