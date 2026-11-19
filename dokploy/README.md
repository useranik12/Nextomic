# Dokploy deployment notes

Dokploy is a hosted control plane (Ubuntu 24.04 VPS), not a file checked into the repo. There is
no Dokploy-specific manifest format to commit. Deploy the whole stack as ONE **Compose** service
pointing at the repo's `docker-compose.yml`; this records what to configure so a deploy matches it.

## Services (all defined in `docker-compose.yml`)

1. **postgres** — `postgres:18-alpine`, pinned to the 18 major for long-term stability. Volume
   `postgres-data` is mounted at `/var/lib/postgresql` (the Postgres 18+ image layout; mounting at
   `/var/lib/postgresql/data` breaks on 18). Not published to the host. Take this volume into
   account in the backup schedule (`docs/platform.md` section 5) once backups are built (Phase 12).
2. **migrate** — one-shot job built from the same `Dockerfile`; runs `bun run migrate` in
   `packages/db` against the compose Postgres and exits. `app` starts only after it completes
   successfully, so a failed migration blocks the deploy instead of booting a mismatched app.
3. **app** — built from the repo's `Dockerfile`. Persistent volumes:
   - `/app/.data/storage` — local storage adapter target (when `STORAGE_ADAPTER=local`)
   - `/app/.data/backups` — backup output (Phase 12)
4. **pgadmin** — `elestio/pgadmin:9.19`, a web UI for the database. Volume `pgadmin-data` keeps its
   saved servers and settings. Needs `PGADMIN_DEFAULT_EMAIL` (a real-looking address) and
   `PGADMIN_DEFAULT_PASSWORD`. In Dokploy, assign a domain to service `pgadmin`, container port 80;
   without a domain it is not reachable. It can run any SQL as the database user you connect with,
   so use a strong password or leave it without a domain. First use: Add New Server, host
   `postgres`, port `5432`, the `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` values.
5. **auth-studio** — the auth dashboard, [Better Auth Studio](https://github.com/Kinfe123/better-auth-studio)
   (beta software, pinned to 1.1.5). Built from `apps/auth-studio/Dockerfile` (a small image, no Next.js
   build) and reads the same Postgres with the same `BETTER_AUTH_SECRET` and the same Better Auth
   configuration as the builder (shared in `packages/auth`), so what you see and change there is the
   builder's real accounts. It serves only the dashboard: no sign-up or sign-in endpoints are exposed.
   Required: `STUDIO_ADMIN_EMAILS` (comma-separated emails of existing builder accounts; the service
   refuses to start without it). Optional: `STUDIO_ALLOWED_IPS` and `STUDIO_BASE_PATH` (default
   `/studio`). In Dokploy, assign a domain to service `auth-studio`, container port 3002, and open
   `https://<domain>/studio`. Sign in there with an allowlisted account's email and password.
   **Security:** the dashboard checks the password only, not passkey or two-factor, and can edit or
   delete any account, so protect the domain too: set `STUDIO_ALLOWED_IPS` (your office or VPN
   addresses) or add Traefik basic auth in Dokploy, and give it its own hostname. Deleting an account
   that owns projects fails by design (projects are not deleted with their creator). The dashboard's
   "seed" tools create fake users: do not use them on a real database.

## Environment variables

Set every variable from `.env.example` in the Dokploy Compose service's Environment tab; compose
interpolates them. `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` are required (compose refuses to
start without them), and the app's `DATABASE_URL` is built from the `POSTGRES_*` values. Set
`BETTER_AUTH_URL` and `STORAGE_PUBLIC_BASE_URL` to the public https origin. Never commit a populated
`.env`; secrets are configured only in Dokploy (or the target host), per the project security rules.

### Email (SMTP)

- **No `SMTP_HOST`:** email verification is NOT required, so the first user can register and is
  signed straight in. Password reset is unavailable (set `DEV_EMAIL_TO_CONSOLE=true` to have reset
  links written to the app logs instead).
- **`SMTP_HOST` set:** verification is required and verification/reset emails are sent through
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` (`SMTP_SECURE=true` for
  implicit TLS; it defaults to true only on port 465).
- Recommended first run: deploy without SMTP, register your owner account, then add SMTP vars and
  redeploy. Per-workspace SMTP with a settings UI is Phase 12.

## Create the service (GitHub deploy)

1. Dokploy > Project > Create Service > **Compose**. Provider **GitHub**, pick the repo and branch,
   Compose Path `./docker-compose.yml`, Compose Type **Docker Compose**.
2. Environment tab: paste the variables from `.env.example` with real values.
3. Domains tab: Host = your domain, **Service Name `app`**, **Port `3000`**, HTTPS on (Let's Encrypt).
4. Deploy. The image is built on the Dokploy server from the `Dockerfile`; enable Auto Deploy for
   push-to-deploy via the GitHub webhook.

## Ports

The compose file publishes NO host ports, so it cannot conflict with other apps on the server.
Traefik reaches `app:3000` over the external `dokploy-network` (Dokploy creates it). Postgres and
`migrate` stay on the stack's private network. Never add `ports:` or `container_name:` here.

## Migrations

Forward-only SQL generated by `bun run --filter @nextomic/db generate` and committed in
`packages/db/migrations`. The `migrate` service applies them on every deploy. Take a backup
before deploying any migration that drops or rewrites data (`docs/platform.md` section 8).

## Local use

One-time: `docker network create dokploy-network` (the base file joins it, as on Dokploy). Needs a
root `.env` copied from `.env.example`. Always layer the dev file locally:

- Full stack: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`
  (app on `127.0.0.1:3000`, Postgres on `127.0.0.1:5432`, pgAdmin on `127.0.0.1:5050` or `PGADMIN_PORT`, the auth dashboard on `127.0.0.1:3002/studio` or `STUDIO_PORT`).
- Host dev (`bun run dev`): same command ending in `up -d postgres`; copy `.env` to
  `apps/editor/.env.local`.
