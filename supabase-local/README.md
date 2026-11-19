# Local Supabase for the Nextomic builder

Self-hosted Supabase for development on localhost. It mirrors the Dokploy deployment (Envoy gateway, Supavisor, Studio, Auth with passkeys, Storage, Realtime, Edge Functions) and is based on the upstream self-hosted release `self-hosted/v0.8.4` (image tags are pinned in `docker-compose.yml`). The production files live in `E:\Development\Nextomic\Documents\Dokploy Files` and are not touched here.

## Run

```
cd supabase-local
docker compose up -d          # start
docker compose down           # stop, keep data
docker compose down -v        # stop and DELETE the database and storage
```

`.env` is gitignored and holds the generated secrets. To recreate it: copy `.env.example`, run `sh utils/generate-keys.sh --update-env` then `sh utils/add-new-auth-keys.sh --update-env`, then set the localhost values listed below.

## Endpoints (all bound to 127.0.0.1)

| What | URL / address |
| --- | --- |
| API gateway (Auth, REST, Storage, Realtime, Functions) | http://localhost:8000 |
| Studio (login: `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` from `.env`) | http://localhost:8000 |
| Auth | http://localhost:8000/auth/v1 |
| Mail catcher (all Auth emails land here) | http://localhost:8025 |
| Postgres via Supavisor, session mode | `localhost:54322`, user `postgres.nextomic` |
| Postgres via Supavisor, transaction mode | `localhost:54329`, user `postgres.nextomic` |

Ports 54322 and 54329 avoid the builder's own Postgres on 5432. API keys: `SUPABASE_PUBLISHABLE_KEY` (browser) and `SUPABASE_SECRET_KEY` (server only) in `.env`.

## Differences from the Dokploy deployment

- Keys are ES256 (asymmetric) plus the opaque `sb_` keys. Production still runs HS256 only.
- Passkeys use RP ID `localhost` and origin `http://localhost:3000`. Production uses `kovidaa.com`, so passkeys cannot be shared between the two.
- New accounts are auto-confirmed like production (so sign-up signs in straight away); mail (magic link, reset, email change, password code) goes to Mailpit.
- Database files are in the named volume `db-data`, not a bind mount (Postgres fails on Windows bind mounts).
- `volumes/api/envoy/cds.yaml` has `dns_lookup_family: V4_ONLY` on every cluster. Docker Desktop gives the network IPv6 addresses, but the services listen on IPv4 only, so Envoy returned 503 for REST and Storage without it.
- The `/mcp` route is deny-all (upstream default).
- Every published port is bound to 127.0.0.1.

## Localhost values changed in `.env`

`POSTGRES_PORT=54322`, `POOLER_PROXY_PORT_TRANSACTION=54329`, `POOLER_TENANT_ID=nextomic`, `STORAGE_TENANT_ID=nextomic`, `SITE_URL=http://localhost:3000`, `ADDITIONAL_REDIRECT_URLS=http://localhost:3000/*`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `PASSKEY_ENABLED=true`, `WEBAUTHN_RP_ID=localhost`, `WEBAUTHN_RP_ORIGINS=http://localhost:3000`.
