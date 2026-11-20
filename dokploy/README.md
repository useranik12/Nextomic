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

### 1. Make the database reachable

The builder needs a SESSION-mode Postgres connection (Supavisor session port, never the transaction
port 6543). How to reach it depends on where the builder runs.

**A. Builder and Supabase on the SAME Dokploy server (preferred, no published port).** Attach Supavisor
to `dokploy-network` in the Supabase compose (Dokploy: Supabase service, edit the compose):

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

Redeploy Supabase and set `DATABASE_URL_INTERNAL` (see the table below). Do not publish Postgres.

**B. Builder on a DIFFERENT server than Supabase (the current production-test setup).** The Docker
network does not cross servers, so publish Supavisor's session port on the Supabase server. That server
may already run other Supabase instances, each holding its own 5432, so pick a free host port
(`ss -tlnp | grep :5434` prints nothing when it is free). In the Supabase compose, `supavisor` service,
keep `expose` and add `ports` for the SESSION port only (container side stays 5432):

```yaml
expose:
  - "5432"
  - "6543"
ports:
  - "5434:5432"
```

Redeploy Supabase, then set `DATABASE_URL` (not `DATABASE_URL_INTERNAL`) in the builder:

```
DATABASE_URL=postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@<supabase-server-ip>:5434/postgres
```

- The user `postgres.<POOLER_TENANT_ID>` selects this instance's tenant, so it never touches the other
  instances' databases.
- Leave `DATABASE_URL_INTERNAL` empty; if it holds the alias the builder tries a host that does not exist.
- A hostname instead of the IP must be DNS only (not Cloudflare proxied); TCP 5434 does not pass the proxy.
- Test from the builder server first: `nc -zv <supabase-server-ip> 5434`.
- Docker-published ports bypass `ufw`. Lock the port to the builder server's IP (and any other client,
  such as n8n) in the provider's cloud firewall. Without a rule, anyone can try the database login.
- The Postgres traffic is not encrypted (Supavisor has no TLS here). Where that matters, put a
  WireGuard or Tailscale link between the servers and publish the port on the tunnel address only
  (`"10.0.0.1:5434:5432"`).
- Reaching the pooler through Traefik (TCP route with TLS) is a later improvement, not done yet.

**Other clients (for example n8n):** use the same host, port and `postgres.<tenant>` user form with SSL
set to disable, and allow their IP in the firewall. Prefer a dedicated limited role (created with
`create role ... login`, granted only the schemas it needs, connected as `<role>.<tenant>`) over the
superuser login.

### 2. Raise the Storage file size limit

In the Supabase compose, `storage` has `FILE_SIZE_LIMIT: 52428800` (50 MB). Videos in the media library
go up to 200 MB, so change it to `209715200` (and redeploy). Per-bucket limits are set by the migrations.

### 3. Environment variables (builder compose, Environment tab)

| Variable                   | Value                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL_INTERNAL`    | Same server only (1A): `postgres://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@nextomic-supavisor:5432/postgres` |
| `DATABASE_URL`             | Separate servers (1B): `postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@<server-ip>:5434/postgres`      |
| `SUPABASE_URL`             | Supabase public URL, e.g. `https://platform-nextomic.kovidaa.com`                                                    |
| `SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_...` key (`SUPABASE_PUBLISHABLE_KEY` in Supabase's env), never the service-role JWT              |
| `SUPABASE_SECRET_KEY`      | the `sb_secret_...` key (`SUPABASE_SECRET_KEY` in Supabase's env). Server only; Storage uses it                      |
| `APP_URL`                  | the builder's public https origin, no path, no trailing slash                                                        |
| `ENCRYPTION_KEY`           | `openssl rand -base64 32`. Losing it makes saved connector secrets unreadable                                        |
| `ALLOW_SIGNUP`             | `true` for the first account, then `false` if only invited people should join                                        |
| `AUTH_PASSWORD_POLICY`     | `medium` (default); match GoTrue's password settings                                                                 |

`SUPABASE_URL_INTERNAL` is optional (an internal gateway address); the public URL works without it.
Everything else in the root `.env.example` has a default. Never commit a populated `.env`.

Set exactly one of `DATABASE_URL` or `DATABASE_URL_INTERNAL` to the real address. The compose uses the
internal one first when both are set. Never paste real keys or passwords into the repo or chat.

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
