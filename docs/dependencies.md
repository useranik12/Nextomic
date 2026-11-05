# Dependencies Spec

There are TWO separate dependency systems. Never mix them.

## A. Builder dependencies (the platform itself)
- Packages the builder app needs to run (Next.js, React, HeroUI, Zustand, dnd-kit, Drizzle, Better Auth, Zod, Tailwind, and so on). HeroUI and Tailwind are builder-only and must never appear in a built site's dependencies.
- Source of truth: the workspace `package.json` files and `bun.lock`.
- Mirrored in `builder-dependencies.json` at the repo root, which is GENERATED, committed, and READ-ONLY.
- Generate with `bun run deps:manifest`. Never hand-edit. CI fails if the manifest is out of date.
- Shown in the UI under Settings > Dependencies > "Builder (built-in)" with a lock icon. No add, edit, or remove actions exist for these; the API rejects any mutation with 403.
- Updated only by the maintainer through normal git + PR + lockfile changes.

## B. Project dependencies (the apps users build)
Each project has its own dependency list, like FlutterFlow's Dependencies page. Three groups:

1. **Built-in (project core):** always included in every generated app and not removable by the user. Defined in `packages/renderer/core-dependencies.json` (e.g. next or astro, react, react-dom, and the Supabase JS client when a Supabase connector or Supabase auth is used). Built sites use the Nextomic CSS framework, so Tailwind and HeroUI are not core dependencies. Shown with a lock icon.
2. **Optional built-in integrations:** curated, versioned toggles maintained by us (e.g. analytics, push notifications, maps). Users can enable or disable; each declares required env vars and init code.
3. **Custom (user-added):** packages the user adds from npm per project (e.g. onesignal, a marquee/carousel library). Fully per-project and removable.

### Data model (`packages/db`)
`project_dependencies`:
- id, project_id
- name (npm package name), version (exact pinned version), kind (`core` | `curated` | `custom`)
- enabled boolean
- target (`client` | `server` | `both`)
- env_vars jsonb (names only; values are stored encrypted like connector secrets)
- init_snippet text (optional, reviewed code that initializes the package)
- integrity (registry shasum/integrity hash), resolved_at
- added_by, created_at, updated_at
Unique on (project_id, name).

### Adding a custom package (flow)
1. User searches by name. Server queries the npm registry (via server route) and shows name, description, latest versions, weekly downloads, license, last publish date, and dependency count.
2. Server validates: name matches the npm name regex, version resolves, not on the denylist, license is not blocked, package is not deprecated (warn).
3. Version is pinned exactly and the integrity hash saved.
4. Package is added to the project's list as `custom`, `enabled`, with target chosen by the user.
5. Env vars the package needs are declared by the user and set as encrypted project secrets.

### Using a custom package
Packages are used only through custom code entities, never by editing generated files:
- **Custom component:** a React component that wraps package exports; appears in the component palette; has a props schema (Zod) so the editor can render controls.
- **Custom action:** a function callable from the action flow (e.g. `OneSignal.login(userId)`).
- **Provider/init snippet:** code that runs once at app start (e.g. OneSignal init), injected into the generated app layout.
Custom code lives in the project (stored as text), is linted and type-checked on save, and is never executed inside the builder's own Node process.

### Security (mandatory)
- Custom packages are NEVER installed or executed in the builder runtime. They are installed only in an isolated build container when publishing or building a preview.
- Build container rules: no host mounts except the project workspace, no access to builder env vars or database, no network except the npm registry (allowlist), CPU/memory/time limits, non-root user.
- Install with scripts disabled: `bun install --ignore-scripts --frozen-lockfile` (generated per-project lockfile; use `npm ci --ignore-scripts` for projects that target Node).
- Editor preview of custom components runs in a sandboxed iframe (`sandbox` attribute, separate origin) and receives only serialized props.
- Run a dependency audit (`bun audit` or the npm audit API) on each build; surface high/critical issues in the UI and block publish on critical (configurable by admin).
- Admin controls: global denylist, optional allowlist mode, max packages per project, max install size.
- Never log env var values. Never include them in generated client bundles unless the name starts with `NEXT_PUBLIC_` and the user confirmed it is public.

### UI (Settings > Dependencies, per project)
- Tabs or sections: Built-in (locked), Integrations (toggles), Custom (add, update version, remove).
- Each row: name, version, target, status (installed, pending, failed), size, license, audit badge.
- Actions: add, change version, enable/disable, remove, view build log.
- Removing a package that is referenced by a custom component or action is blocked with a message listing the references.

### Tests
- Unit: name and version validation, denylist, pinning, reference checks.
- Integration: add package, build container installs with scripts disabled, publish succeeds.
- Security tests: attempt a malicious postinstall script and confirm it does not run; confirm the container cannot reach the builder DB or env.

### Phase placement
Builder manifest script and read-only view in Phase 0. Project dependencies UI, registry search, build container, and custom code entities (the Custom Codes page) in Phase 10 (Dependencies and custom code).

The Project Dependencies page follows the FlutterFlow "Project Dependencies" pattern (see `blueprint/inspiration/flutterflow-app-settings.png`); it lives in App Settings under Project Setup.
