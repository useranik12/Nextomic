# Dokploy deployment notes

Dokploy is a hosted control plane (Ubuntu 24.04 VPS), not a file checked into the repo. There is no
Dokploy-specific manifest to commit. The builder runs on a self-hosted Supabase, which is a SEPARATE
Dokploy Compose project. Deploy two things:

1. **Supabase** (project `nextomic-supabase`): Auth, Postgres, Storage, the gateway. Not part of this repo.
2. **The builder**: ONE Compose service pointing at this repo's `docker-compose.yml`.

## What the builder compose contains

- **migrate**: one-shot job from the same image; runs `bun run migrate` in `packages/db` against
  Supabase Postgres and exits. `app` starts only after it succeeds, so a failed migration blocks the
  deploy instead of booting a mismatched app. The migrations also create the three Storage buckets.
- **app**: the builder (Next.js on port 3000). Everything it keeps (users, projects, media) lives in
  Supabase; the `storage-data` volume is used only when `STORAGE_ADAPTER=local` (tests).

Both services join the external network `dokploy-network`, so they can reach other Dokploy projects by
service name or alias.

## Connecting the builder to Supabase

### 1. Make the database reachable (internal network, not the internet)

The builder needs a SESSION-mode Postgres connection (Supavisor port 5432, never the transaction port
6543). Supabase's Supavisor only exposes 5432 inside the Supabase project's own network, so attach it to
`dokploy-network` in the Supabase compose (Dokploy: Supabase service, edit the compose):

```yaml
services:
  supavisor:
    networks:
      default: {}
      dokploy-network:
        aliases:
          - nextomic-supavisor

networks:
  dokploy-network:
    external: true
```

Redeploy Supabase. Do not publish Postgres to the host.

### 2. Raise the Storage file size limit

In the Supabase compose, `storage` has `FILE_SIZE_LIMIT: 52428800` (50 MB). Videos in the media library
go up to 200 MB, so change it to `209715200` (and redeploy). Per-bucket limits are set by the migrations.

### 3. Environment variables (builder compose, Environment tab)

| Variable                   | Value                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL_INTERNAL`    | `postgres://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@nextomic-supavisor:5432/postgres` |
| `SUPABASE_URL`             | Supabase public URL, e.g. `https://platform-nextomic.kovidaa.com`                             |
| `SUPABASE_PUBLISHABLE_KEY` | the Supabase publishable (anon) key                                                           |
| `SUPABASE_SECRET_KEY`      | the Supabase secret (service role) key. Server only; Storage uses it                          |
| `APP_URL`                  | the builder's public https origin, no path, no trailing slash                                 |
| `ENCRYPTION_KEY`           | `openssl rand -base64 32`. Losing it makes saved connector secrets unreadable                 |
| `ALLOW_SIGNUP`             | `true` for the first account, then `false` if only invited people should join                 |
| `AUTH_PASSWORD_POLICY`     | `medium` (default); match GoTrue's password settings                                          |

`SUPABASE_URL_INTERNAL` is optional (an internal gateway address); the public URL works without it.
Everything else in the root `.env.example` has a default. Never commit a populated `.env`.

If you cannot attach Supavisor to `dokploy-network`, publish its session port instead and use
`DATABASE_URL=postgres://postgres.<tenant>:<password>@<server-ip>:<port>/postgres`, and firewall that
port to the VPS only.

### 4. Supabase Auth settings the builder expects

- `SITE_URL` and the redirect allow-list include the builder's public origin (`APP_URL`), and
  `API_EXTERNAL_URL` is the public `.../auth/v1` address.
- Passkeys: RP ID is the parent domain, origins include the builder's origin.
- Password policy matches `AUTH_PASSWORD_POLICY` (`GOTRUE_PASSWORD_MIN_LENGTH`,
  `GOTRUE_PASSWORD_REQUIRED_CHARACTERS`). Email: SMTP is configured on Supabase Auth, not in the builder.

## Domains

Assigned in Dokploy (Domains tab of the Compose service), not in the environment.

| Service | Example domain         | Container port |
| ------- | ---------------------- | -------------- |
| `app`   | `nextomic.example.com` | 3000           |

Each needs a DNS record and HTTPS (Let's Encrypt). Supabase has its own domain in its own project.

## First deploy order

1. Deploy Supabase with the two changes above.
2. Deploy the builder compose with the variables set. Watch `migrate`: it must print
   `Migrations applied.` Then `app` becomes healthy.
3. Open the builder domain and register the owner account (SMTP on Supabase Auth if verification is on).
4. Check Supabase Studio, Storage: buckets `nextomic-builder-assets`, `customer-data` and `app-uploads`
   exist. Uploaded project files appear as `app-uploads/<workspace>/<project>/media-assets/<type>/<file>`.

## Backups

Back up Supabase's Postgres volume and the Storage volume together (they reference each other: library
rows link to storage objects). `/app/.data/backups` is reserved for the builder's own backups (Phase 12).
