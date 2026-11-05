# Graph Report - nextomic-starter - Codex  (2026-11-05)

## Corpus Check
- 66 files · ~31,858 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .css 1)

## Summary
- 708 nodes · 800 edges · 89 communities (47 shown, 42 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Visual Design Sources
- docs/fonts-and-icons.md
- Delivery Roadmap
- Element Data Model
- Repository Governance
- Repository Governance
- docs/integrations.md
- editor/package.json
- docs/design-system.md
- Platform Architecture
- Built App Architecture
- Platform Operations
- Dynamic Data and Actions
- db/package.json
- Product Specification
- package.json
- Connector Contracts
- Schema Governance
- Schema Governance
- Action Flow Editor
- Connector Security
- Dependency Boundary
- Universal Data Binding
- Brand Identity
- Session Security
- Isolated Package Builds
- Design System Boundary
- Application State
- Font Hosting
- Product Specification
- auth.ts
- steps
- schema/package.json
- compilerOptions
- compilerOptions
- editor
- css-framework/package.json
- integrations/package.json
- renderer/package.json
- runtime/package.json
- generate-dependency-manifest.ts
- docs/templates-and-themes.md
- .prettierrc.json
- css-framework/tsconfig.json
- db/tsconfig.json
- integrations/tsconfig.json
- renderer/tsconfig.json
- runtime/tsconfig.json
- schema/tsconfig.json
- css-framework/src/index.ts
- integrations/src/index.ts
- renderer/src/index.ts
- runtime/src/index.ts
- icon.tsx
- schema/src/index.ts
- builder-dependencies.json
- dependencies
- docs/elements.md
- docs/ui-reference.md
- Project specifications
- assets.ts
- LICENSES.md
- db@workspace:*
- drizzle-orm@^0.44.7
- eslint@^9.39.1
- eslint-config-next@^16.0.7
- @eslint/js@^9.39.1
- @heroui/react@^3.2.7
- @iconify/react@^6.0.2
- next@^16.0.7
- @nextomic/schema@workspace:*
- @nextomic/storage@workspace:*
- nodemailer@^7.0.10
- postgres@^3.4.7
- react@^19.2.0
- react-dom@^19.2.0
- tsx@^4.20.6
- @types/node@^24.10.1
- @types/nodemailer@^7.0.2
- @types/react@^19.2.2
- @types/react-dom@^19.3.0
- typescript@^5.9.3
- zod@^4.1.12

## God Nodes (most connected - your core abstractions)
1. `Nextomic Builder repository` - 71 edges
2. `Brand assets` - 22 edges
3. `Builder UI component references` - 17 edges
4. `compilerOptions` - 13 edges
5. `Project specifications` - 13 edges
6. `scripts` - 11 edges
7. `Builder page references` - 8 edges
8. `editor` - 7 edges
9. `compilerOptions` - 6 edges
10. `scripts` - 5 edges

## Surprising Connections (you probably didn't know these)
- `ProjectsPage()` --calls--> `ProjectsShell()`  [EXTRACTED]
  apps/editor/src/app/projects/page.tsx → apps/editor/src/components/projects-shell.tsx
- `ProjectsShell()` --calls--> `Icon()`  [EXTRACTED]
  apps/editor/src/components/projects-shell.tsx → apps/editor/src/components/icon.tsx
- `auth` --calls--> `sendPlatformEmail()`  [EXTRACTED]
  apps/editor/src/lib/auth.ts → apps/editor/src/lib/platform-mail.ts
- `AuthProvider contract` --implements--> `REST connector and API Data`  [EXTRACTED]
  docs/app-auth.md → docs/integrations.md
- `AuthProvider contract` --implements--> `Supabase connector`  [EXTRACTED]
  docs/app-auth.md → docs/integrations.md

## Import Cycles
- None detected.

## Communities (89 total, 42 thin omitted)

### Community 0 - "Visual Design Sources"
Cohesion: 0.07
Nodes (5): Builder UI component references, Builder interaction inspiration, Builder page references, Brand assets, Nextomic Builder repository

### Community 1 - "docs/fonts-and-icons.md"
Cohesion: 0.25
Nodes (7): Fonts and Icons Spec, 2. Text fonts, 3. Icon libraries, 4. Use in the editor and output, 1. Where it lives, 5. Phase placement, 6. Tests

### Community 2 - "Delivery Roadmap"
Cohesion: 0.12
Nodes (16): Build Phases, Phase 8: Authentication for built apps, Phase 9: Advanced templates, Phase 10: Dependencies and custom code, Phase 11: Publish, export, import, GitHub, Phase 12: Platform administration, Phase 13: Dashboard, polish, and starter templates, Phase 14: Reusable components (deferred) (+8 more)

### Community 3 - "Element Data Model"
Cohesion: 0.12
Nodes (16): Route protection, Bidirectional CSS editing, StyleMap model, Query model, Element component registry, ElementNode schema, Project icon libraries, Connector resource binding (+8 more)

### Community 4 - "Repository Governance"
Cohesion: 0.13
Nodes (14): Phased development workflow, Project: Nextomic Builder (Kovidaa Technologies), Code standards, Security, Definition of done, graphify, Design sources (`blueprint/`), Separate layers (never mix) (+6 more)

### Community 5 - "Repository Governance"
Cohesion: 0.14
Nodes (13): Phased development workflow, Project: Nextomic Builder (Kovidaa Technologies), Code standards, Security, Definition of done, Design sources (`blueprint/`), Separate layers (never mix), Stack (+5 more)

### Community 6 - "docs/integrations.md"
Cohesion: 0.07
Nodes (26): Fourteen-phase delivery plan, Builder-platform authentication, Per-project App Settings, Authentication for Built Apps, 7. Settings data, 8. Builder preview, 9. Tests, 10. Out of scope for now (+18 more)

### Community 7 - "editor/package.json"
Cohesion: 0.06
Nodes (44): dependencies, better-auth@^1.4.15, db@workspace:*, @heroui/react@^3.2.7, @heroui/styles@^3.2.7, @iconify-json/ph@^1.2.2, @iconify/react@^6.0.2, next@^16.0.7 (+36 more)

### Community 8 - "docs/design-system.md"
Cohesion: 0.14
Nodes (13): Design System Spec, 2. Style data model (single source of truth), 0. Two design systems (never mix), 3. Classes and IDs (Bricks-style), 4. Bidirectional CSS, 5. Design tab groups, 6. Variables and tokens, 7. Nextomic CSS framework (+5 more)

### Community 9 - "Platform Architecture"
Cohesion: 0.15
Nodes (12): apps/editor, Built sites layer, docs/dynamic-data-and-actions.md, docs/spec.md, docs/ui-reference.md, AGENTS.md project instructions, Project documentation, Universal dynamic data (+4 more)

### Community 10 - "Built App Architecture"
Cohesion: 0.17
Nodes (11): apps/editor, Built sites layer, docs/dynamic-data-and-actions.md, docs/spec.md, docs/ui-reference.md, CLAUDE.md project instructions, Project documentation, Universal dynamic data (+3 more)

### Community 11 - "Platform Operations"
Cohesion: 0.17
Nodes (11): Platform Spec, 2. Roles and project members, 3. Security settings, 4. SMTP (multiple), 5. Backups, 6. Export and import, 7. App Settings (per project), 1. Auth (Better Auth) (+3 more)

### Community 12 - "Dynamic Data and Actions"
Cohesion: 0.18
Nodes (10): Dynamic Data, State, and Actions Spec, 9. Tests, 2. Scoping rules, 3. Queries, 1. Dynamic data, 4. Loops, 5. State: app state, constants, page state, 6. Type conversion and formatting (+2 more)

### Community 13 - "db/package.json"
Cohesion: 0.11
Nodes (20): dependencies, drizzle-orm@^0.44.7, postgres@^3.4.7, devDependencies, drizzle-kit@^0.31.4, typescript@^5.9.3, exports, ./schema (+12 more)

### Community 14 - "Product Specification"
Cohesion: 0.25
Nodes (7): Nextomic Builder: Product Spec, Doc index (read the relevant doc before working in an area), Feature matrix, Decisions log, Principles, Open questions for the owner, Glossary

### Community 15 - "package.json"
Cohesion: 0.07
Nodes (34): devDependencies, eslint@^9.39.1, eslint-config-next@^16.0.7, @eslint/js@^9.39.1, husky@^9.1.7, prettier@^3.6.2, tsx@^4.20.6, @types/node@^24.10.1 (+26 more)

### Community 16 - "Connector Contracts"
Cohesion: 0.50
Nodes (5): AuthProvider contract, Connector interface, REST connector and API Data, Supabase connector, Platform and integration boundary

### Community 17 - "Schema Governance"
Cohesion: 0.50
Nodes (3): Component registry, JSON data model, packages/schema

### Community 19 - "Schema Governance"
Cohesion: 0.50
Nodes (3): Component registry, JSON data model, packages/schema

### Community 20 - "Action Flow Editor"
Cohesion: 0.67
Nodes (3): Authentication action catalog, Action flow model and catalog, Action flow editor UI

### Community 21 - "Connector Security"
Cohesion: 0.67
Nodes (3): Builder connector proxy, Encrypted connector secrets, Connector proxy SSRF protection

### Community 31 - "auth.ts"
Cohesion: 0.09
Nodes (21): dynamic, GET(), getHandlers(), POST(), auth, environment, environmentSchema, getEnvironment() (+13 more)

### Community 32 - "steps"
Cohesion: 0.11
Nodes (17): jobs, test, runtime, name, on, pull_request, push, if (+9 more)

### Community 33 - "schema/package.json"
Cohesion: 0.16
Nodes (13): dependencies, zod@^4.1.12, devDependencies, typescript@^5.9.3, exports, typescript, zod, name (+5 more)

### Community 34 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noFallthroughCasesInSwitch, noImplicitOverride (+5 more)

### Community 35 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, baseUrl, incremental, jsx, paths, plugins, exclude, extends (+2 more)

### Community 36 - "editor"
Cohesion: 0.07
Nodes (29): context, dockerfile, postgres, build, depends_on, env_file, environment, ports (+21 more)

### Community 37 - "css-framework/package.json"
Cohesion: 0.20
Nodes (10): devDependencies, typescript@^5.9.3, exports, typescript, name, private, scripts, build (+2 more)

### Community 38 - "integrations/package.json"
Cohesion: 0.20
Nodes (10): devDependencies, typescript@^5.9.3, exports, typescript, name, private, scripts, build (+2 more)

### Community 39 - "renderer/package.json"
Cohesion: 0.20
Nodes (10): devDependencies, typescript@^5.9.3, exports, typescript, name, private, scripts, build (+2 more)

### Community 40 - "runtime/package.json"
Cohesion: 0.20
Nodes (10): devDependencies, typescript@^5.9.3, exports, typescript, name, private, scripts, build (+2 more)

### Community 41 - "generate-dependency-manifest.ts"
Cohesion: 0.22
Nodes (5): dependencies, manifestPaths, PackageManifest, root, workspaceDirectories

### Community 42 - "docs/templates-and-themes.md"
Cohesion: 0.25
Nodes (7): Themes and Templates, 2. Conditions (shared by themes and templates), 5. Pages, 6. Tests, 3. Themes, 1. Vocabulary (use these words exactly), 4. Templates

### Community 43 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 44 - "css-framework/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 45 - "db/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 46 - "integrations/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 47 - "renderer/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 48 - "runtime/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 49 - "schema/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 56 - "icon.tsx"
Cohesion: 0.11
Nodes (9): nextConfig, metadata, ProjectsPage(), Icon(), iconRegistry, RegisteredIconName, navigation, ProjectsShell() (+1 more)

### Community 57 - "schema/src/index.ts"
Cohesion: 0.24
Nodes (5): workspacePermissions, StorageDriver, storageDriverSchema, WorkspaceRole, workspaceRoleSchema

### Community 58 - "builder-dependencies.json"
Cohesion: 0.20
Nodes (9): @heroui/styles@^3.2.7, husky@^9.1.7, tailwindcss@^4.3.4, typescript-eslint@^8.46.3, generatedAt, @heroui/styles, husky, tailwindcss (+1 more)

### Community 59 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, better-auth@^1.4.15, drizzle-kit@^0.31.4, @iconify-json/ph@^1.2.2, prettier@^3.6.2, better-auth, drizzle-kit, @iconify-json/ph (+1 more)

### Community 60 - "docs/elements.md"
Cohesion: 0.22
Nodes (8): Elements Spec, Universal dynamic data (mandatory), Element node (packages/schema), Elements panel (builder UI), Catalog, Build order for Phase 7, Built-site look, Tests

### Community 61 - "docs/ui-reference.md"
Cohesion: 0.25
Nodes (7): Builder UI Reference, 2. Design coverage, 5. Brand assets, 6. Open items the owner must confirm, 3. Design system (builder UI), 4. Screens, 1. Rules for following the designs

### Community 62 - "Project specifications"
Cohesion: 0.40
Nodes (4): Dependencies Spec, B. Project dependencies (the apps users build), A. Builder dependencies (the platform itself), Project specifications

## Knowledge Gaps
- **188 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 383 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Nextomic Builder repository` connect `Visual Design Sources` to `docs/fonts-and-icons.md`, `Delivery Roadmap`, `Repository Governance`, `Repository Governance`, `docs/integrations.md`, `docs/design-system.md`, `docs/templates-and-themes.md`, `Platform Operations`, `Dynamic Data and Actions`, `Product Specification`, `builder-dependencies.json`, `docs/elements.md`, `docs/ui-reference.md`, `Project specifications`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` to the rest of the system?**
  _188 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Visual Design Sources` be split into smaller, more focused modules?**
  _Cohesion score 0.06688311688311688 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `builder-dependencies.json`, `db@workspace:*`, `drizzle-orm@^0.44.7`, `eslint@^9.39.1`, `eslint-config-next@^16.0.7`, `@eslint/js@^9.39.1`, `@heroui/react@^3.2.7`, `@iconify/react@^6.0.2`, `next@^16.0.7`, `@nextomic/schema@workspace:*`, `@nextomic/storage@workspace:*`, `nodemailer@^7.0.10`, `postgres@^3.4.7`, `react@^19.2.0`, `react-dom@^19.2.0`, `tsx@^4.20.6`, `@types/node@^24.10.1`, `@types/nodemailer@^7.0.2`, `@types/react@^19.2.2`, `@types/react-dom@^19.3.0`, `typescript@^5.9.3`, `zod@^4.1.12`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `Delivery Roadmap` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `Project specifications` connect `Project specifications` to `Visual Design Sources`, `docs/fonts-and-icons.md`, `Delivery Roadmap`, `docs/integrations.md`, `docs/design-system.md`, `docs/templates-and-themes.md`, `Platform Operations`, `Dynamic Data and Actions`, `Product Specification`, `docs/elements.md`, `docs/ui-reference.md`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `Element Data Model` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._