# Admin dashboard (planned, not started)

Everything for the Nextomic admin app lives in this directory: its code, its Dockerfile and its own
`docker-compose.yml`. The repository stays one. On Dokploy the admin app is a separate Compose
service that points at `admin-dashboard/docker-compose.yml`, so it deploys on its own, with its own
domain, database and login.

## What it is

An internal, lightweight control app for the Nextomic builder. Only the internal team signs in.

- Its own Postgres and its own Better Auth. No link to the builder's database or login.
- It reads builder data (the builder's Supabase, the builder's S3 storage, server state) and shows it.
- It changes the builder only through the builder's control tables (`platform_*`) with a restricted
  database role, never by editing builder tables directly. See `docs/spec.md`, "Platform
  architecture (planned)".

## Planned features

User, workspace and project management; maintenance mode; announcements and "what's new" pop-ups;
package updates (a pull request that CI validates, then a Dokploy deploy); a visual email builder
for the builder's own emails; an audit log of admin actions; later system health, plans and quotas,
abuse reports, impersonation and feature flags.

## Rules for this directory

- Shared code (UI kit, email builder, the control-table contract) goes in `packages/`, not copied here.
- Do not import the editor, canvas, elements or action flows.
- Nothing here is built yet. The first step is listed in `docs/spec.md`.
