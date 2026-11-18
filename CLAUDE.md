# Project: Nextomic Builder (Kovidaa Technologies)

A self-hosted, visual builder for reactive, responsive, dynamic, complex websites and web apps (output: Next.js and Astro). It combines Bricks-style design systems, themes, and dynamic data, FlutterFlow-style queries, app state, action flows, and authentication, and Instatic-style self-hosting.

IMPORTANT: The builder itself does NOT run on Supabase. It runs on its own PostgreSQL database and Better Auth. Supabase and REST APIs are INTEGRATIONS that users connect to the apps they build.

## Read the docs first

Before working in an area, read its doc in `docs/`. If a doc and the code disagree, or a doc is silent, stop and ask. Update the doc in the same change when a decision changes.

- `spec.md` overview, principles, feature matrix, decisions log, open questions
- `ui-reference.md` how the BUILDER UI looks and behaves, design coverage, rules for following the designs
- `elements.md` element node shape, catalog, universal dynamic data, build order
- `design-system.md` classes, IDs, variables, CSS framework, animations, bidirectional CSS, the two design systems
- `fonts-and-icons.md` text fonts (Google, Fontsource, upload, self-hosted) and icon libraries (popular free sets, icon fonts, custom imports) for built sites
- `templates-and-themes.md` themes (multiple, conditional), color modes, templates (header, footer, 404, popup, archive, single), conditions
- `dynamic-data-and-actions.md` dynamic data, scoping, queries, loops, state, transforms, conditions, action flows and the action flow editor
- `app-auth.md` authentication for the end users of built apps (providers, sessions, route guards, auth actions, auth forms)
- `integrations.md` Supabase and REST (API Data) connectors, secrets, proxy
- `dependencies.md` builder (locked) vs project dependencies
- `platform.md` builder auth, roles, App Settings, SMTP, backups, export/import, GitHub, security
- `phases.md` build order and checklists

Design sources (`blueprint/`) and how to follow them: see `apps/editor/CLAUDE.md`.

## Separate layers (never mix)

1. **Platform:** the builder app. Own Postgres, Better Auth, storage, projects, publishing. No Supabase code or keys.
2. **Integrations:** Supabase and REST connectors and auth providers for built apps (`packages/integrations`).
3. **Built sites:** generated output using the Nextomic CSS framework (CSS variables and classes). No Tailwind or HeroUI required in output.
   Builder UI styling (Tailwind + HeroUI + `blueprint/tokens.json`) must never leak into built-site CSS. Built sites use the project's own design system and themes.

## Stack

- Language: TypeScript (strict, no `any`)
- Runtime and package manager: Bun (latest) with workspaces. Node (latest LTS) must also work; CI runs tests on both. Verify the Next.js production server under Bun; if there is an issue, run Next on Node, keep Bun for tooling, and record it in `docs/spec.md` decisions log.
- Builder app: Next.js (App Router) in `apps/editor`
- Builder UI: HeroUI v3 components with Tailwind CSS v4 (use the versions HeroUI's current docs require; verify before installing). Tokens from `blueprint/tokens.json`. Dark-first, light mode supported. Design rules: `docs/ui-reference.md` section 3.
- Icons (builder UI): Iconify with locally bundled SVG data from Streamline, Lineicons, Phosphor, Fluent and similar sets; Google Material Symbols only as a last-resort fallback. Licenses recorded in `assets/icons/LICENSES.md`. See `docs/ui-reference.md` (Icons).
- State: Zustand (with Immer), undo/redo history
- Drag and drop: @dnd-kit
- Database: PostgreSQL with Drizzle ORM and SQL migrations
- Auth (builder): Better Auth (email/password, Google and other social, passkeys, rate limiting, roles)
- Storage: storage adapter (local volume, S3-compatible)
- Validation: Zod (schema is the single source of truth)
- CSS parsing: PostCSS or lightningcss (for bidirectional CSS)
- Hosting: Dokploy on Ubuntu 24.04 VPS (Docker, Bun image)

## Dependency versions (owner rule, always)

- Any new package, dependency, base image, Docker image, GitHub Action or tool must be added at its latest STABLE release, found by checking the registry or official docs at the time (not from memory).
- Pin the EXPLICIT full version number (for example `16.4.6`, `postgres:18.1-alpine`, `oven/bun:1.4.4`). Never `latest`, `lts`, a bare major (`postgres:18`, `oven/bun:1`), `^`, `~`, `*`, or `x` ranges.
- No nightly, canary, beta, alpha, rc, next, dev or testing builds, ever.
- If the newest stable release is blocked by a peer dependency or breaks the app, stop and tell the owner; do not silently fall back to an older version or a pre-release.
- Upgrades follow the same rule. After any add or upgrade run `bun run deps:manifest` and record a decision in `docs/spec.md` if the choice is not obvious.
- Existing exceptions to clean up when next touched: `postgres:18-alpine` and `oven/bun:1` in `docker-compose.yml` and `Dockerfile` use a major tag only.

## Repo layout

- `blueprint/` design sources (READ-ONLY): `pages/`, `components/`, `inspiration/`, `design-system/`, `tokens.json`, `tools/`
- `assets/` brand assets, icons, fonts. Use the asset registry (slug names); never hardcode paths.
- `docs/` the specs listed above, plus generated `schema.md`
- `builder-dependencies.json` GENERATED, READ-ONLY manifest of the builder's own packages. Run `bun run deps:manifest`; never edit by hand.
- `apps/editor` builder UI and server routes
- `packages/schema` Zod schemas and types: project, page, template, theme, element, class, variable, query, binding, condition, action, auth settings
- `packages/renderer` element JSON to React/Next and Astro output, `core-dependencies.json`
- `packages/css-framework` Nextomic CSS framework (reset, variables, element default classes)
- `packages/runtime` client runtime shipped with built apps (actions, state, queries, auth client)
- `packages/db` Drizzle schema, migrations (platform DB only)
- `packages/integrations` connector interface, Supabase and REST connectors, auth providers
- `packages/storage` storage adapter (local, S3-compatible)

## Commands

- Dev: `bun run --filter editor dev`
- Test: `bun test` (and `bun run test:node` for the Node pass)
- DB generate migration: `bun run --filter @nextomic/db generate`
- DB apply migration: `bun run --filter @nextomic/db migrate`
- Builder dependency manifest: `bun run deps:manifest`

Run lint, typecheck, and tests before declaring any task done.

## Core rules

1. Everything is JSON data (pages, templates, themes, classes, variables, queries, actions). The editor edits JSON; the renderer and exporter generate code.
2. `packages/schema` is the source of truth. Change schema first, then editor, renderer, and docs.
3. Every element registers in the component registry (type, defaults, Zod props, Content/Design/Action controls, events, bindable props, editor render, Next render, Astro render).
4. Every element has three tabs: Element (content, properties, dynamic data, conditional visibility, loop), Design (CSS), Action (event flows). Show a change dot for any property changed at a breakpoint. Breakpoints are user-defined (defaults: desktop base, tablet, mobile); never hardcode three.
5. Classes: edits apply to the element unless a class is added AND selected as the active target; then only that class changes. Visual design and CSS text are bidirectional with round-trip tests. Unrepresentable CSS is preserved in `raw`, never dropped.
6. Dynamic data works EVERYWHERE: every element prop, attribute, style value, class toggle, condition operand, action parameter, route and SEO field accepts static text mixed with dynamic tokens via the bolt icon. A prop may opt out only with a written reason in the registry. Scope rules in `dynamic-data-and-actions.md` are enforced at save time.
7. Supabase/REST schema is stored as STRUCTURE only. Never store row data from connected sources. Editor previews fetch live or use sample values the user wrote.
8. Element IDs: `nxtomc-` + 8 random `a-z0-9` chars when "Generate element ID automatically" is on; unique per page.
9. The platform never imports `@supabase/*`. Only `packages/integrations` and generated output of user apps may.
10. Two dependency systems (see `dependencies.md`): builder dependencies are locked and read-only; project dependencies are per project. User-added npm packages are NEVER installed or executed in the builder runtime; only in isolated build containers (scripts disabled) and sandboxed previews.
11. Custom HTML/JS/CSS and custom code run only in the sandboxed canvas iframe and in built output, never in the builder's own process.
12. Secrets never reach the browser or exported files. Exports include `.env.example`, not credentials.
13. Match the Figma frames and `docs/ui-reference.md`. If a screen or behavior is ambiguous or not designed, ask. Do not guess.
14. Themes (style sets, many per site, chosen by conditions) and color modes (light/dark inside a theme) are different things. Templates (header, footer, 404 first) apply by conditions. Never conflate them. See `templates-and-themes.md`.
15. Authentication actions are available on every element and in forms. Raw tokens never reach HTML, dynamic data, or custom code. See `app-auth.md`.
16. Reusable components are NOT in scope yet. Reserve the `componentInstance` node type in the schema only.

## Workflow

- Work ONE phase at a time from `docs/phases.md`. Do not start the next phase until I approve.
- Start each phase with a short plan and files to create or change. Wait for my OK on large changes.
- Do not build all elements at once. Follow the build order in `elements.md`.
- Small commits with clear messages after each working step.
- Ask before building when requirements conflict or are missing.
- After changing codes/major change on the repository, update the graphify yourself.

## Code standards

- Production-ready only: no TODO stubs, no placeholder logic, no stray console.log.
- Handle loading, empty, and error states in every UI and data call.
- Validate all external input (forms, API bodies, imports, connector configs, CSS, custom code metadata) with Zod.
- Small typed functions; components under ~200 lines; extract hooks.
- Accessibility: semantic HTML, keyboard support, labels, focus states, alt text (builder UI and built output). Popups need focus trap and Escape.
- Performance: memoize canvas nodes, avoid re-rendering the whole tree on a single prop change; virtualize long lists (layers, class manager, media grid).
- Tests: unit tests for schema, store, CSS round trip, bindings, conditions, theme resolution, transforms, actions, auth, renderer, connectors; e2e for create, edit, bind data, action, sign in, publish, export, import.

## Security

- Never commit secrets. Use `.env.local`; keep `.env.example` updated.
- Every query scoped by authenticated user and workspace/project membership; enforce permissions on the server for every route and action.
- Parameterized queries only (Drizzle).
- Better Auth: secure cookies, CSRF protection, rate limits on login/signup/reset; signup can be disabled by admin.
- Built-app auth: httpOnly session cookies by default, server-side route guards, same-origin `next` redirects only.
- Sanitize rich text, SVG, and user-supplied URLs. Validate uploads (type, size, magic bytes).
- SSRF protections on every server-side outbound call (see `integrations.md`).

## Definition of done

- Lint, typecheck, and tests pass (Bun and Node)
- Works at every project breakpoint (built output) and at laptop to desktop widths (builder shell)
- Matches the Figma frame (or the inspiration structure with Nextomic styling)
- Docs updated for any schema, behavior, or decision change
- Summary: what changed, how to test, known limits

## Working agreements (owner preferences)

- When the owner says to build something, build it. Do not stop for an extra OK on items already agreed. Ask only when requirements conflict or a screen is not designed.
- Never push to GitHub (or trigger a deploy) until the owner says so. Push with an explicit target, `git push origin <local>:<remote-branch>`, never `-u`. Local `production-test` tracks `origin/main` on purpose, so a plain `git push` refusing is the wanted safety.
- Commit messages and PR text carry no co-author or tool-attribution lines, and docs, code comments and commits do not name the AI tooling used.
- Record progress in `docs/phases.md` and decisions in `docs/spec.md` so any session can resume from the docs alone.

## Local Docker (the owner tests on Docker Desktop)

- After every code or file change, rebuild so the owner can test: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`. Always include the dev override file; without it no host port is published.
- Verify after each rebuild: the build output has no `failed` / `Failed to compile` (a failed build can silently keep the old container, so tests pass on stale code), `curl http://127.0.0.1:3000` answers (307 redirect or 200), and `docker ps` shows `127.0.0.1:3000->3000`. Never leave a host `next start` on port 3000.
- Clean up after a verified rebuild: `docker builder prune -af` and `docker image prune -f`. Never prune volumes (Postgres data). Delete stale test output (`test-results`, `playwright-report`, scratch files).
- `app` and `migrate` share one image (`nextomic-builder:latest`); `app` owns the build.

## Testing economy

- While iterating run only affected unit tests (`bun x vitest run <paths>`). Run the full `bun run test` and `bun run test:node` once at the end and read only the summary line.
- Never run bare `bun test` at the repo root: it picks up Playwright e2e specs and hangs. Unit tests are `bun run test` (vitest).
- e2e: run only the affected spec files with `--reporter=dot`; run the full suite only when shared code (shell, auth, store) changed. Use `E2E_BASE_URL=http://localhost:3000` (Better Auth rejects other origins as "Invalid origin"). Use `--workers=2` or 3 for full runs, since a few specs are flaky under heavy parallel load.
- e2e selectors: BoltInput fields share their label with the bolt button, so use `getByRole("textbox", { name })`, not `getByLabel`. HeroUI v3 switches need `click({ force: true })`. Menu items are `getByRole("menuitem")`. Select options inside a modal are found with `page.locator("[role=option]", { hasText })`.
- No screenshot probes unless a visual question needs one. Do not re-run gates that already passed.

## Test Supabase instance

- The owner's self-hosted test instance is `https://platform.kovidaa.com`. Keys live in the root `.env` (gitignored) as `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`. Never copy keys into docs, commits or chat.
- Do not run Supabase in Docker. Built apps use only the anon key. e2e against it is read-only: never write rows and never sign up accounts there. Tests that need it skip when the variables are unset.

## Environment gotchas

- There is no Python on the owner's Windows machine: write file-edit scripts in Node. Prettier is `node_modules/.bin/prettier`.
- App Router files must not import modules that import `react-dom/server` (the Docker build fails while local tsc passes). The public site endpoints that need `renderToStaticMarkup` live under `src/pages/api` (Pages Router).
- Dynamic props are `{ kind: "mixed", parts }` values, not raw `"{{ }}"` strings. Dynamic tags need spaces: `{{ tag }}`.
- `packages/db` migrations: `bun run --filter @nextomic/db generate` then `migrate`. The `migrate` service runs them on deploy.
