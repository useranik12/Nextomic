<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brandings/svg/name-logo-dark.svg">
  <img alt="Nextomic Builder" src="assets/brandings/svg/name-logo-light.svg" height="72">
</picture>

### Build reactive, responsive, data-driven websites and web apps visually. Self-hosted. Export clean Next.js or Astro.

![License](https://img.shields.io/badge/license-proprietary-red?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-F9F1E1?style=for-the-badge&logo=bun&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

[Website](http://kovidaa.com/) · [YouTube](https://www.youtube.com/@kovidaa.technologies) · [LinkedIn](https://www.linkedin.com/in/useranik12/)

</div>

---

## What is Nextomic Builder?

Nextomic Builder is a self-hosted visual builder for complex websites and web apps. It brings together three ideas:

- **Design systems and themes** with classes, IDs, variables, a CSS framework, color modes and bidirectional CSS (edit visually or as CSS text).
- **Dynamic data and logic** with queries, loops, app state, conditions, action flows and end-user authentication.
- **Self-hosting** on your own server, with your own database, storage and users.

Everything you build is stored as JSON. The editor edits the JSON, and the renderer exports clean **Next.js** or **Astro** code.

> The builder runs on its own PostgreSQL database and Better Auth. Supabase and REST APIs are _integrations_ that you connect to the apps you build. The builder itself never depends on them.

## Highlights

| Area                | What you get                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Visual editor       | Drag and drop canvas, layers, element panel with Element, Design and Action tabs, custom breakpoints      |
| Design system       | Colors with shades, typography and spacing scales, variables, classes, fonts, many themes with conditions |
| Dynamic data        | Bind any prop, style, condition or action parameter to data with dynamic tokens                           |
| Data sources        | Supabase and REST connectors (schema only, no row data stored)                                            |
| Auth for built apps | Providers, sessions, route guards, auth actions and forms                                                 |
| Platform            | Roles, workspaces, SMTP, backups, export and import, GitHub sync                                          |
| Output              | Next.js and Astro, using a lightweight CSS framework with no Tailwind needed                              |

## Tech stack

TypeScript (strict) · Bun workspaces · Next.js (App Router) · HeroUI + Tailwind (builder UI only) · Zustand + Immer · dnd-kit · PostgreSQL + Drizzle ORM · Better Auth · Zod · Docker.

## Repository layout

```
apps/editor          Builder UI and server routes (Next.js)
packages/schema      Zod schemas and types, the single source of truth
packages/renderer    Element JSON to React / Next / Astro output
packages/css-framework  Nextomic CSS framework for built sites
packages/runtime     Client runtime shipped with built apps
packages/db          Drizzle schema and SQL migrations (platform database)
packages/integrations  Supabase and REST connectors, auth providers
packages/storage     Storage adapter (local volume or S3-compatible)
docs/                Specs and decisions (start with docs/spec.md)
dokploy/             Deployment notes for Dokploy
```

## Quick start (local)

Requirements: [Bun](https://bun.sh) (latest), Docker Desktop, Git.

```bash
git clone https://github.com/useranik12/Nextomic.git
cd Nextomic
cp .env.example .env            # then set POSTGRES_PASSWORD and BETTER_AUTH_SECRET
docker network create dokploy-network   # one time only
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Open <http://127.0.0.1:3000>. The first account you register becomes the owner.

> Always include `-f docker-compose.dev.yml` locally. Without it no host port is published and the app is not reachable.

Generate a strong secret with:

```bash
openssl rand -base64 48
```

### Develop without rebuilding the image

```bash
bun install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
cp .env apps/editor/.env.local
bun run --filter @nextomic/db migrate
bun run --filter editor dev
```

## Deploy to your server (Dokploy)

The whole stack deploys as one Docker Compose service on a VPS (Ubuntu 24.04 recommended).

1. **Install Dokploy** on the server: `curl -sSL https://dokploy.com/install.sh | sh`, then open the Dokploy panel.
2. **Create the service**: Project, Create Service, **Compose**. Provider **GitHub**, choose this repository and the `main` branch. Compose Path `./docker-compose.yml`, type **Docker Compose**.
3. **Set environment variables** in the Environment tab, using `.env.example` as the list. These are required:
   - `POSTGRES_PASSWORD` a strong password
   - `BETTER_AUTH_SECRET` a long random string
   - `BETTER_AUTH_URL` and `STORAGE_PUBLIC_BASE_URL` your public `https://` address
4. **Add the domain**: Domains tab, Service Name `app`, Port `3000`, HTTPS on.
5. **Deploy.** Turn on **Auto Deploy** to redeploy on every push to `main`.
6. Register your owner account. To lock the instance afterwards, set `ALLOW_SIGNUP=false` and redeploy.

The stack contains three services: `postgres` (data volume), `migrate` (applies SQL migrations, then exits) and `app` (the builder). The compose file publishes no host ports, so it does not clash with other apps on the server. More detail is in [`dokploy/README.md`](dokploy/README.md).

**Email.** With no `SMTP_HOST`, email verification is skipped so the first user can sign up. Set the `SMTP_*` variables when you are ready to send verification and reset emails.

**Backups.** Back up the `postgres-data` volume and the app's `/app/.data/storage` volume before any release that includes a migration.

## Updating a deployed instance

On your machine, ship the change:

```bash
git add -A
git commit -m "describe the change"
git push origin main
```

With Auto Deploy on, Dokploy rebuilds and redeploys. Without it, press **Deploy** in the Dokploy panel. Migrations run automatically before the app starts, and a failed migration blocks the release instead of starting a mismatched app.

To update a local Docker copy after pulling changes:

```bash
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
curl -I http://127.0.0.1:3000    # expect HTTP 307
```

## Git cheat sheet

```bash
git status                         # what changed
git pull origin main               # get the latest
git add -A && git commit -m "msg"  # save a snapshot
git push origin main               # publish
git log --oneline -10              # recent history
git diff                           # unstaged changes
git checkout -b feature/name       # start a branch
git push -u origin feature/name    # publish a branch
git restore <file>                 # discard changes to one file
```

## Commands

| Task                | Command                                  |
| ------------------- | ---------------------------------------- |
| Install             | `bun install`                            |
| Dev server          | `bun run --filter editor dev`            |
| Build               | `bun run build`                          |
| Lint                | `bun run lint`                           |
| Typecheck           | `bun run typecheck`                      |
| Tests               | `bun run test`                           |
| Tests (Node)        | `bun run test:node`                      |
| New migration       | `bun run --filter @nextomic/db generate` |
| Apply migrations    | `bun run --filter @nextomic/db migrate`  |
| Dependency manifest | `bun run deps:manifest`                  |
| Icon registry build | `bun run icons:build`                    |

Run lint, typecheck and tests before every push.

## Documentation

Specs live in [`docs/`](docs): [`spec.md`](docs/spec.md) (overview and decisions), [`ui-reference.md`](docs/ui-reference.md), [`elements.md`](docs/elements.md), [`design-system.md`](docs/design-system.md), [`templates-and-themes.md`](docs/templates-and-themes.md), [`dynamic-data-and-actions.md`](docs/dynamic-data-and-actions.md), [`app-auth.md`](docs/app-auth.md), [`integrations.md`](docs/integrations.md), [`platform.md`](docs/platform.md), [`phases.md`](docs/phases.md).

## Credits

**Developer:** [Kovidaa Technologies](http://kovidaa.com/)

Thanks to [@useranik12](https://www.linkedin.com/in/useranik12/) for building and driving the project.

- Website: <http://kovidaa.com/>
- YouTube: <https://www.youtube.com/@kovidaa.technologies>
- LinkedIn: <https://www.linkedin.com/in/useranik12/>

## License

**Proprietary.** Copyright © Kovidaa Technologies. All rights reserved. No part of this software may be copied, modified, distributed or used without written permission from Kovidaa Technologies.
