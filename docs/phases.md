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
- [x] Drafts with Save/Discard and an unsaved-changes guard on data forms, grouped expression suggestions with search, `{{` auto-close, tag highlighting with hover values and Navigator problem dots, scheduled publish _Built: `draft-scope.tsx`, `expression/*`, `schedule-dialog.tsx`, `ui/date-time-field.tsx`, `server/publish.ts` (`runDuePublish`)._
- [x] Supabase page and API Data page from the designs; schema fetch saves structure only _Supabase page built (4d): connector, schema fetch (anon key), tables and views, storage browsing, Supabase Row type. API Data page built (4c): `schema/{rest,json-path}.ts`, `integrations/src/rest/*`, `server/connectors/rest-data.ts`, `components/editor/api-data/*`, e2e `api-data.spec.ts`._
- [x] Connector secrets encryption and server proxy with SSRF protection _Built (4b): `packages/integrations` (contract, registry, errors, secrets, address guard, safeFetch), `server/connectors/*`, proxy route, migration 0005. No connector type is registered yet: Supabase registers in 4d, REST in 4c._
- [ ] Queries (page, element/loop, action-triggered), parameters, loading/empty/error states _4e step 1 built: query loop model and scope (`schema/query.ts`, `query-scope.ts`), Navigator query icon and loop-aware tag checks. Step 2 built: query execution (`schema/query-run.ts`, `server/queries/run-query.ts`, `runQueryAction`, Supabase containment filters). Step 3 built: Query Loop group in the Element tab (`components/editor/query/`). Step 4 built: loop rendering (children repeated per row, `loopRows`), server render on the site and preview (`pageLoopRows`), live canvas preview (`useCanvasLoopRows`), query loop groups in the dynamic data picker. Step 5 built: client runtime (`LoopRuntime`: infinite scroll at 90%, realtime reloads) and the public site loop endpoint (`/api/site/<id>/loop`, rate limited). Step 6: e2e for Supabase and REST loops (canvas, preview, published infinite scroll, realtime subscription, endpoint rejects forged keys). **4e (element query loops) is complete.** Still open in this item: page and template queries, loading/empty/error state elements. Action-triggered queries moved to Phase 5._
- [x] Dynamic data modal (bolt icon): groups, scope rules, dot notation, live preview on canvas, type-aware _Built across 4a-4f: grouped tags with search, loop groups by scope, dot notation, hover values on canvas, type hints, transforms. Done 2026-11-09._
- [x] Universal bindability: every registered prop, attribute, style value, class toggle, SEO and route field accepts dynamic tokens _Audited 2026-11-09: bolt on every element prop (registry test fails on an unmarked prop; another test resolves a token in every bindable prop), attributes, style values, SEO and page name fields, condition operands, query filters. Route pattern opts out with a written reason (`elements.md`). "Class toggle" became class, ID and attribute condition types (owner decision 2026-11-09); adding and removing classes is a Phase 5 action._
- [x] Loops on div-based elements with auto-duplicated children _Query loops on Container and Section built in 4e (owner decision: those two only). Other Loops (page parameters, page state, app state, constants, parent item, static JSON, expression) built in 4f; browser-persisted app state re-renders with the Phase 5 state store._ _Done; live re-render of browser state moved to Phase 5._
- [x] Transforms (type conversion) and date/time formatting presets _Built 2026-11-09 in the bolt modal (owner choice A); chains compile to expression methods. See `dynamic-data-and-actions.md` section 6._
- [x] Conditional visibility; runtime condition operands for themes and templates _Element conditional visibility built 2026-11-09 (Element tab > Conditions; see `dynamic-data-and-actions.md` section 7); class, ID and attribute condition types on this or another element, and chip input for list operators, added the same day). Still open: runtime (browser) operands for theme and template rules, and live re-checks of browser state (Phase 5 state store)._ _Done 2026-11-09. Moved to Phase 5: live re-checks of browser state and of classes, IDs and attributes changed by actions (failing elements must then stay in the page, hidden), runtime (browser) operands for theme and template rules._
- [x] Tests: scope validation, loops, transforms, bindings everywhere, connectors _Covered: `query-scope`/`query*.test.ts`, `loop-names`, `query-loop-rows`, `transforms`, `expression`, `condition`, renderer bindable tests, `integrations` (secrets, address guard, safeFetch, REST, Supabase), e2e api-data, supabase, editor (loops, transforms, conditions)._

## Phase 5: Actions

Docs: `dynamic-data-and-actions.md` (section 8), `ui-reference.md` (4.8)

**Proposed plan (2026-11-09, awaiting owner approval; owner will provide more action flow editor inspiration first):**

- Steps: 5a action schema + Action Flow Editor UI (flows saved, not run); 5b client runtime + live state (page/app state store, live condition re-checks, loop re-render); 5c core actions (navigation, state, show/hide/toggle, class/ID/attribute, wait, condition, parallel, refresh query, toast/dialog/confirm); 5d form, media, animation, color mode, device, clipboard actions; 5e server actions (send email, webhook, bucket upload, Supabase insert/update/delete/rpc, REST call; generated server handlers, secrets in env); 5f dry run in the editor and tests.
- 5a schema: `packages/schema/src/action.ts` with the section 8.3 model (action / condition with then-else reusing the visibility rule builder / parallel lanes; params are text with tags; outputName, onSuccess, onError, disabled, name). `actions: Record<triggerId, ActionStep[]>` on elements, pages, templates (old empty `unknown[]` data reads as is, no migration). `action-catalog.ts` (type, category, icon, Zod params, allowed targets, card summary; missing required param = error). `action-triggers.ts` (section 8.2 list filtered per element type).
- 5a UI (`components/editor/actions/*`): left column title + element/page name, trigger search, "+" trigger menu, trigger list with count badge and delete; center flow canvas with cards ("Action N", name, summary, kebab), "+" above and below the selected card, True/False and parallel lanes side by side, red "Not defined"; right "Define Action" (editable name, kebab disable/duplicate/delete, searchable categorized type picker, params with bolt, output name; "Action outputs" bolt group only for later steps); top right error badge (jumps to first) and Close. Undo/redo through the store `edit()`; explicit save. App Action Blocks shown disabled "Coming later".
- Undesigned, needs owner OK: (1) element Action tab lists the element's triggers with counts and an "Open Action Flow Editor" button (a trigger click opens it there); (2) an "Actions" button in Page Settings and Template Settings opens the same editor with page triggers.
- Owner decisions 2026-11-10 (supersede the matching points above; inspiration `blueprint/inspiration/flutterflow-action-flow-editor-*.png`, structure only, Nextomic look):

  - Element Action tab has two tabs, **Actions** and **Action Blocks**. Actions: "Add action" button when empty; otherwise one card per trigger (trigger name large, "N actions" small muted = enabled actions); click opens that trigger in the modal; kebab menu: disable, copy, cut, delete (red) action flow.
  - **Action Blocks** are reusable project flows (parameters, return value), created from the tab ("Add action block") or by Ctrl+drag selecting nodes in a flow and converting. Editing a block updates every use, like a component; no detach.
  - Modal: header title + element name, issues badge, icon buttons **Test**, **Save**, **Close**. No trigger yet: centered "Select Action Trigger" dropdown. Left: trigger search, "+", trigger list with count and delete. Trigger with no actions: "No Actions Created" + Add Action / Conditional Action / Loop / Parallel Action / Try-Catch / Action Block. Center: auto-arranged top-to-bottom node flow like FlutterFlow (no free n8n canvas); nodes with "Action N", name, summary, up/down arrows, kebab; "+" above and below; container boxes for condition (if / else if / else), loop (for each item / while, with break and continue), parallel lanes, try/catch. Right: Define Action (name, kebab, searchable expandable categories, unavailable actions greyed with an info hint, params with bolt, output name).
  - Node right-click or kebab popup with icons: Test node action (top), copy, paste (when something is copied), cut, delete.
  - **Save** in the modal saves flows independently of the page draft (flows stored apart from the page tree; flows of elements deleted by a page save are removed).
  - **Test** runs the whole flow or a single node for real, whatever the action does.
  - Page and template flows: select the page (or template) root, like a FlutterFlow scaffold; its Action tab shows page triggers (page load, timer, custom event).
  - Conditionally hidden elements stay OUT of the DOM (no CSS or JS hiding). When an action makes the condition pass, the runtime inserts the element (HTML fetched from the server, which re-checks server-known conditions); when it fails, the runtime removes it. Browser-side operands (classes, state) cannot be verified by the server, so only server-known conditions protect content.
  - Element lifecycle triggers to include: When Load (mounted, including re-inserted and new loop rows), When Visible In Viewport / Leaves Viewport (IntersectionObserver: amount, margin, once or every time), When Position In Viewport (edge crosses a viewport line, direction), Scroll Progress, When Resized (ResizeObserver), media/image load and error.
  - Lists received: `blueprint/action-flow-sytem.md` is the base structure. Every listed trigger and action must exist; ones not supported yet (unbuilt elements, later phases) show disabled with an info icon and reason.
  - Additions (owner answers 2026-11-10): "HTML/CSS Properties" sub-section under Element/UI Interactions (add/remove/toggle class, set/remove ID, set/remove attribute, set text); no direct show/hide actions (classes drive class conditions); REST (API Data) call under Backend; Toast/snackbar and Confirm dialog under Alert/Notifications; triggers Hover Start/End, Focus/Blur, Leaves Viewport, and on page roots Key Press, Timer/Interval, Page Leave, Online/Offline; Set Theme and Set UI Mode move to Element/UI Interactions; Share keeps mailto/tel/sms (SMTP send email goes to Integrations later); push notification dropped; standalone "Pick File(s)" action (single, or multiple with optional max) with modes Store Locally and Upload To Supabase (stored files feed S3 presigned and REST uploads); Execute Custom Code listed disabled until Phase 10.
  - Actions that return data (queries, files, auth, modal, bottom sheet, confirm...) have an output variable name: unique in the flow, empty = not usable. Outputs appear in the bolt under Actions > `<name>`, only for later nodes.

- **5a plan (proposed 2026-11-10, awaiting owner OK):** (1) schema `packages/schema/src/actions/*`: `flow.ts` nodes (action, condition, loop, break, continue, parallel, try/catch, block call), `catalog.ts` (category, subcategory, icon, param fields, output type, browser or server, available or disabled with reason), `triggers.ts` (common, page root, element-specific from the registry); registry declares element triggers and commands; Action Blocks with typed params (incl. Element type) and return value. (2) storage independent of page save: tables `action_flows` (one row per element on a page or template, version for conflicts) and `action_blocks`; publish snapshots flows; page save removes rows of deleted elements; flows of duplicated or pasted elements are written with the page save. (3) right panel Action tab with Actions and Action Blocks tabs (cards, kebab menu, paste). (4) modal per the decisions above, Test disabled until 5b. (5) docs (`dynamic-data-and-actions.md` section 8 rewrite, `ui-reference.md` 4.8, `elements.md`, `schema.md`) and tests. Commit in steps, stop for review after the modal works. Then 5b runtime + live state + fragment endpoint + Test, 5c core actions, 5d Supabase/REST/auth/Pick File(s), 5e remaining UI and media actions.

- **5a progress:** step 1 built 2026-11-10 (owner OK): `packages/schema/src/actions/*` (fields, triggers, catalog, flow, flow-check, blocks) with tests. Decisions made while building: element-specific triggers are keyed by element type in the schema, not repeated in the renderer registry; icons stay in the builder UI; Try/Catch replaces per-action onSuccess/onError; the extra auth actions of `app-auth.md` sit inside Supabase Authentication (Login methods, Verify One-Time Code, Update User Metadata, Resend Verification). Owner 2026-11-10: no Refresh Session or Get Current User actions; the built-app runtime refreshes the Supabase session automatically (5b). Step 2 built 2026-11-10: storage (`action_flows`, `action_blocks`, migration 0010, sync on page/template save, copy on duplicate, flows and blocks in publish snapshots, server actions). Step 3 built 2026-11-10: element Action tab (`components/editor/actions/*`: flow store, Actions cards with disable/copy/cut/delete and paste, Action Blocks list, flows carried by duplicate/copy/paste and sent with the page save). Step 4 built 2026-11-10: flow editor modal (`components/editor/actions/editor/*`).

  - Owner review 2026-11-10, changes made: modal keeps a 16px gap on every side; canvas moves with a right-button drag on free space (grabbing cursor) and zooms with the wheel around the pointer (25-200%, buttons for zoom and reset); trigger menu as wide as its names, with an (i) tip per trigger (every available trigger has a description); start buttons stacked; action sub-groups (Supabase Authentication, Supabase, Supabase File...) are their own accordions; Supabase database actions pick columns from the saved structure (Columns, Filters, Order, Values, Conflict columns), Single row comes first and hides Limit; issues flag unknown columns, empty values for columns that cannot be null, and insert/upsert missing a column with no default that cannot be null; Navigate To leaves out the page being edited; new Reload Page action (delay in ms); For Each loop has start index, end index (inclusive), step size, and a generated read-only item name `loop_<6 chars>_<list name>` (underscores, because a dash in an expression is a minus sign); Navigator shows a sky-blue lightning icon next to the query icon when an element has actions, and clicking it opens the flow editor.
  - Rebuild Page stays one action (owner left it to us): on a website only the open page is mounted and other pages read app state fresh when they open, so "Rebuild All Pages" does nothing useful. Rebuild Page runs the page's queries again and redraws the page with its header and footer templates.
  - Actions do not run and Test stays disabled until 5b (runtime).
  - Step 5 done 2026-11-10: docs (`ui-reference.md` 4.8, `elements.md`, `dynamic-data-and-actions.md` section 8, `schema.md`) and e2e (add trigger and action, save, reload, Navigator icon, wheel zoom). Also: Dynamic Data modal groups pack in masonry columns; the Navigator query icon opens the element's Query Loop settings. 5a complete; next 5b.

- **5b plan (owner OK 2026-11-10):** (1) flow engine `packages/runtime/src/flow/*` (pure, runs every node kind, fills tags, outputs, loop start/end/step, try/catch `{ code, message }`, Action Blocks; server-run actions error "does not run yet" until 5d); (2) trigger host on `/site` and `/preview` (one delegated listener per event via `data-nid`, IntersectionObserver, ResizeObserver, root triggers, loop row scope); (3) live state: one client store (app state incl. persisted, page state); on change the runtime asks the server to re-render the affected elements with the new state and swaps their HTML in (**owner chose server fragments**: conditionally hidden elements never reach the browser before their condition passes); (4) starter actions: Show Toast, Wait, Debug Log, Update App/Page State, Set Text, Navigate To, Navigate Back, Reload Page, Rebuild Page; (5) Test in the flow editor modal: runs the open trigger (or one node) for real in the canvas iframe on the unsaved draft, with a step log (status, output or error, time); (6) docs and tests.

  - **Toast template (owner 2026-11-10):** new template type `toast`. Show Toast renders the published toast template (server fragment) with `{{ toast.title }}`, `{{ toast.message }}`, `{{ toast.type }}`; with no published toast template, Show Toast fails with a clear error and the flow editor warns. A new toast template starts from a design modeled on the HeroUI (NextUI) toast, built from Nextomic elements and styles (no HeroUI CSS in output).
  - Step 1 built 2026-11-10: flow engine with tests.
  - Step 2 built 2026-11-10: toast template type with the HeroUI-like starter design; Show Toast fields title, message, type, position, duration.
  - Step 3 built 2026-11-10: runtime on `/site` and `/preview` (`packages/runtime/src/flow/page-runtime.ts`, `live-state.ts`, `handlers.ts`, `dom.ts`), payload (`apps/editor/src/server/runtime/page-runtime.ts`), fragment endpoint (`pages/api/site/[id]/fragment.ts`), `liveSlots` in the renderer, published views carry flows and page routes, theme CSS keeps template classes. Rebuild All Pages dropped (only the open page is mounted on a website). See `dynamic-data-and-actions.md` 8.6.
  - Later (owner note): Set Theme and Set UI Mode show disabled when the project has no matching setting (several themes / dark mode on). Do this when the main actions are finished.

- [x] Action flow editor modal replicating the FlutterFlow structure with Nextomic styling (triggers list, flow canvas, Define Action panel, error badge) (5a, 2026-11-10)
- [ ] `packages/runtime` client runtime (tree-shakable)
- [ ] Live state (moved from Phase 4): client state store, live re-checks of conditions (browser state, classes/IDs/attributes changed by actions), loop re-render, browser operands for theme and template rules
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
- [x] SMTP from environment variables only (owner decision 2026-11-08: no SMTP settings in the builder), queued sending with retries, built-in auth email templates _Built: `server/mail/*`. Built apps read their own `SMTP_\*` variables (Phase 5 send-email action).\_
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
