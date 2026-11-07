# Integrations Spec

Integrations are features of the BUILT apps. The builder platform itself never uses them (platform = own Postgres + Better Auth).

## 1. Concepts

- **Connector:** a saved, per-project connection to an external service (Supabase or REST API).
- **Resource:** something a connector exposes (a table, an endpoint, a storage bucket, an auth action).
- **Binding:** a link in page JSON between a component prop/action and a resource. Bindings reference connector and resource IDs, never credentials.
- **Proxy:** server route in the builder that executes connector calls on behalf of the editor (preview) so secrets never reach the browser.

## 2. Connector interface (`packages/integrations`)

```ts
export type ConnectorType = "supabase" | "rest";

export interface ConnectorContext {
  projectId: string;
  workspaceId: string;
  signal: AbortSignal;
}

export interface TestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface Connector<TConfig, TSecrets> {
  readonly type: ConnectorType;
  configSchema: import("zod").ZodType<TConfig>;
  secretsSchema: import("zod").ZodType<TSecrets>;
  test(cfg: TConfig, secrets: TSecrets, ctx: ConnectorContext): Promise<TestResult>;
  listResources(cfg: TConfig, secrets: TSecrets, ctx: ConnectorContext): Promise<Resource[]>;
  execute(
    cfg: TConfig,
    secrets: TSecrets,
    req: ExecuteRequest,
    ctx: ConnectorContext
  ): Promise<ExecuteResult>;
}
```

Rules:

- Every connector is registered in a registry, like components.
- Config (non-secret) and secrets are separate Zod schemas. Config is stored as JSON; secrets are encrypted.
- All connector errors are normalized to `{ code, message, status?, details? }`. Never leak raw upstream stack traces or secrets.

## 3. Supabase connector

UI: the Supabase page (see `ui-reference.md` 4.4 and `blueprint/pages/editor-supabase.png`).

Config: `projectUrl`, `schema` (default `public`), `active` (toggle), `auth.google` (`enabled`, `webClientId`).
Secrets: `anonKey` (anon or publishable key; required; masked in the UI, stored encrypted). **Only the anon key is used** (owner decision 2026-11-08): no service role key in the builder or in built apps. What the connector can read and write is exactly what the project's grants and RLS give the anon role.
Auth settings (public values): enabled providers and their client IDs, for example Google "Web Client ID". These only take effect when App Settings > Authentication is set to Supabase (see `app-auth.md`).

Capabilities:

- **Fetch Schema** (button): reads PostgREST's OpenAPI 2.0 document at `GET /rest/v1/` with the anon key (tables, views, columns, types, primary and foreign keys from the `<pk/>` / `<fk .../>` markers, enum values, defaults, nullability, and `/rpc/*` functions with their parameters) plus the buckets from `GET /storage/v1/bucket`, and saves the STRUCTURE only in `connector_schemas`. A path with no write method is shown as a view (read only for this key). Fetch saves changed URL/key fields first; creating the connection runs the test. **Clear Schema** removes the saved structure after a confirm that lists app state variables typed as Supabase Row.
- Tables & Views browser: searchable list, columns with Field Name, Data Type (the Nextomic type list: Number, String, Boolean, Timestamptz, JSON, with "list" for arrays), PostgreSQL type, key icon for primary keys, a star for favorite fields (user metadata saved with the structure; stars on columns that disappear are dropped on the next fetch), foreign key target.
- Type mapping (`nextomicTypeOf` in `packages/schema/src/supabase.ts`): integer, numeric, real, double and money types are Number; boolean is Boolean; timestamp, date and time types are Timestamptz; json and jsonb are JSON; everything else (text, varchar, uuid, enums) is String. `x[]` is a list of x.
- Execute (proxy `execute` op, server side): `select` (validated column names, `eq/neq/gt/gte/lt/lte/like/ilike/is/in` filters, order, limit up to 1000, offset), `insert`, `update` and `delete` (both need at least one filter), `rpc`, and `storage.list` (one folder of a bucket). Resource ids: `table:<name>`, `view:<name>`, `rpc:<name>`, `bucket:<name>`.
- Storage: the bucket list shows what the anon key can see. Supabase returns only buckets the anon role may read (RLS on `storage.buckets`); when none come back, the page shows the policy to add (`create policy ... on storage.buckets for select to anon using (true)`). Persisted per bucket: name, public flag, and the top-level entry count (capped at 1000, shown as "1000+"). Folder listings are fetched live (connection must be on) and never saved. Public buckets show the public object URL with "Copy URL"; private bucket files are reached with signed URLs at run time.
- Bindings can pass the end user's JWT so the end project's own RLS applies (with queries, later in Phase 4).
- The "Active" toggle off hides the connector's resources from pickers and flags existing bindings as inactive (warning, not silent failure). Turning it on runs the test first.
- "Supabase Row" in the type pickers lists the saved tables and views; it is disabled until a schema is fetched.

Rules:

- Generated client code reads keys from env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), never inline literals.
- RLS status is not visible to the anon key, so there is no RLS warning.

Built (4d): `packages/integrations/src/supabase/{connector,openapi,query}.ts`, `packages/schema/src/supabase.ts`, `apps/editor/src/server/connectors/supabase-schema.ts`, actions in `connector-actions.ts`, UI in `components/editor/supabase/*`. Tests: unit (parsing, mapping, request building, structure), a live check against a real project (`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`; skipped when unset) and `e2e/supabase.spec.ts`.

## 4. REST connector (the API Data page)

UI: see `ui-reference.md` 4.5 and `blueprint/pages/editor-api-data-*.png`.

Structure: **API groups** contain **API calls**. Calls can also be ungrouped.

- Group: `name`, `baseUrl` (https only; http and local hosts only with `ALLOW_PRIVATE_CONNECTOR_HOSTS` in development, see section 6), shared `headers`, shared auth.
- Call: `name`, `active` (toggle), `method` (GET, POST, PUT, PATCH, DELETE), `endpoint` (path appended to the group base URL), `headers[]`, `body` (`none | text | json | multipart`, plus form-urlencoded if needed), `variables[]`, `advancedSettings` (not designed: timeout, retries, caching, pagination; ask before building the UI), `responseSchema` (saved structure).
- Method badge colors: GET green, POST purple, PUT orange, PATCH amber, DELETE pink/red. An inactive call shows a muted badge with a red x.

Secrets: tokens, API key values, and basic credentials stored encrypted (config holds only references).

Placeholder syntax in the editor (follows the designs):

- JSON/text bodies: `<variable_name>` (highlighted in the code editor; click a variable chip under "Available variables to add" to insert).
- Headers, URL, endpoint, and query params: `[variable_name]` (for example `Authorization: [apikey]`).
- Header lines are entered as `key: value` and can contain placeholders.
- A placeholder that is not defined in Variables is a validation error. A variable with a default value uses the default when the caller passes nothing.

Variables tab columns: Name, Type (String, Integer, Float, Boolean, JSON, DateTime), Is List (True/False), Default Value, bolt (marks the variable as typically bound to dynamic data), delete, and "Add Variable".

Built-in variables (always available, not defined by the user): `jwt` (the signed-in end user's access token, resolved on the server only) and `user_ip` (client IP resolved on the server from trusted proxy headers; never accepted from the client).

Capabilities:

- **Test API tab:** run the call with sample values; show status, headers, body, and latency. A successful test can "Save schema": the response shape is inferred and saved as STRUCTURE only (no response data stored). The saved structure powers dynamic data tokens and query fields.
- Response mapping: JSONPath-style selectors map the response to a typed shape (list, object, scalar).
- Pagination presets: none, page/limit, offset/limit, cursor.
- Retry (idempotent GET only), timeout, and caching options per call.
- Footer actions: Delete API (confirm; warn about bindings), Cancel, Save API.

## 5. Secrets

- Encrypt with AES-256-GCM. Key from `ENCRYPTION_KEY` (32 bytes, base64). Store `ciphertext`, `iv`, `tag`, and `key_version`.
- Support key rotation via `key_version`.
- Decrypt only inside server routes at call time. Never log secrets. Never return secrets to the client; return only `hasSecret: true` and a masked tail.
- Editing a connector with a blank secret field keeps the existing secret; `null` removes it.
- Environment: `ENCRYPTION_KEY` (current key), `ENCRYPTION_KEY_VERSION` (default 1), `ENCRYPTION_PREVIOUS_KEYS` (`version:base64,...`, older keys kept readable). Rotate by moving the old key into the previous list, setting a new key and raising the version; a secret is re-encrypted with the current key the next time its connector is saved.
- All of a connector's secrets are one sealed JSON object. The connector id is bound in as additional authenticated data, so ciphertext copied to another row does not open.
- The browser sees `{ hasSecret: true, tail }`; `tail` (last 4 characters) is shown only for secrets of 16 characters or more.

Built (4b): `packages/integrations/src/secrets.ts`, `apps/editor/src/server/connectors/env.ts`.

## 6. Proxy (`apps/editor` server route)

Pipeline for each call: authenticate (Better Auth session) → authorize (user belongs to project's workspace) → load connector → decrypt secrets → validate request with Zod → SSRF check → execute → normalize result.

Hard requirements:

- SSRF protection: resolve DNS, block private, loopback, link-local, and metadata ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7); re-check after redirects; limit redirects to 3.
- Timeouts (default 15s, max 30s), response size cap (default 5 MB), allowed content types.
- Per-user and per-project rate limits.
- Strip hop-by-hop headers and any attempt to override `Host` or auth headers outside the configured fields.
- Audit log entry per call: project, connector, resource, status, duration (no bodies, no secrets).

Built (4b):

- Route: `POST /api/projects/{projectId}/connectors/{connectorId}` with `{ op: "test" | "resources" | "execute", request? }`. Same-origin JSON only (Origin must match the host, `content-type: application/json`, body up to 1 MB). Answers `{ ok: true, data }` or `{ ok: false, error: { code, message } }`; 400 invalid request, 401 signed out, 403 no access or cross-site, 404 unknown connector, 429 rate limited, 502 any other connector error.
- `execute` needs the connector to be on; `test` and `resources` work while it is off. Saving a connector as on runs its test first and refuses when it fails.
- Network access: connectors reach the network only through `safeFetch` (`packages/integrations/src/safe-fetch.ts`). Each hop resolves the host, refuses it when ANY address is blocked (`address-guard.ts`, which also decodes IPv4-mapped, NAT64 and 6to4 IPv6), then connects to the checked address itself with TLS verified by host name, so DNS cannot change between check and connect. https only. Up to 3 redirects, each checked again; credentials (`authorization`, `cookie`, `apikey`, `x-api-key`) are dropped when a redirect leaves the origin. Timeout 15s default, 30s max. 5 MB cap on decoded bytes (compressed bombs cannot pass). Allowed response types: JSON, `+json`, `text/*`, XML.
- Private hosts: `ALLOW_PRIVATE_CONNECTOR_HOSTS=true` lets connectors reach loopback, private and CGNAT addresses and plain http, only when `NODE_ENV` is not production. Link-local and cloud metadata addresses (169.254.0.0/16, 100.100.100.200, fd00:ec2::254) stay blocked always.
- Rate limits: 60 calls per minute per user and 300 per minute per project, in memory (one container; a second replica would need a shared store).
- Files: `apps/editor/src/server/connectors/{operation,proxy,store,env}.ts`, `server/rate-limit.ts`, server actions in `app/(builder)/editor/[id]/connector-actions.ts` (list with masks, save, delete).

## 7. Bindings in page JSON (`packages/schema`)

```ts
type Binding =
  | { kind: "static"; value: unknown }
  | { kind: "variable"; scope: "page" | "app" | "route" | "component"; path: string }
  | {
      kind: "resource";
      connectorId: string;
      resourceId: string;
      params: Record<string, Binding>;
      select?: string; // path into the response
    };

type Action =
  | {
      type: "callResource";
      binding: Extract<Binding, { kind: "resource" }>;
      onSuccess?: Action[];
      onError?: Action[];
    }
  | { type: "setVariable"; scope: "page" | "app"; path: string; value: Binding }
  | { type: "navigate"; to: string; params?: Record<string, Binding> };
```

- Lists: a repeater component binds to a resource returning an array; child components bind to the item scope.
- Every resource binding must define loading, empty, and error UI.
- Publish step resolves bindings to generated fetch code that calls the end service directly (Supabase) or a generated server route (REST with secrets), never the builder proxy.

## 8. Platform tables (`packages/db`)

- `connectors`: id, project_id, type, name, active, config jsonb, secret_ciphertext, secret_iv, secret_tag, key_version, created_by, created_at, updated_at
- `connector_schemas`: connector_id (primary key, one saved structure per connector), structure jsonb (tables, columns, types, buckets, or inferred response shapes; NO row data), fetched_at, hash
- `api_groups`: id, connector_id, name, base_url, headers jsonb, sort
- `api_calls`: id, group_id (nullable), connector_id, name, active, method, endpoint, headers jsonb, body_type, body_template, variables jsonb, advanced jsonb, response_schema jsonb, sort
- `connector_audit_log`: id, connector_id, user_id, operation (test, resources, execute), resource_id, status (HTTP status or error code), duration_ms, created_at
  All rows are scoped by workspace through the project. Every query enforces workspace membership.
  Built (4b, migration `0005_connectors.sql`): `connectors` (unique name per project), `connector_schemas`, `connector_audit_log`. `api_groups` and `api_calls` come with 4c.

## 9. UI

- Left rail: "Supabase" and "API Data" are two separate items, as in the Supabase and API Data screens (`ui-reference.md` 4.3). There is no Data Management group.
- Binding picker in the properties panel (static, variable, resource) and the dynamic data modal.
- Clear error messages; a successful test (or Fetch Schema) is required before a connector or call can be marked active.

## 10. Tests

- Unit: config and secret schemas, encryption round trip, SSRF blocklist, response mapping, binding resolution, placeholder parsing (`<var>` and `[var]`), built-in variables (`jwt`, `user_ip`) cannot be overridden by the client, schema save contains no row data.
- Integration: Supabase connector against a local Supabase test instance; REST connector against a mock server.
- E2E: add connector, test, bind list to a component, preview, publish.

## 11. Out of scope for now

OAuth2 flows for REST, GraphQL connector, webhooks, and Firebase. Design the interface so they can be added without changing existing connectors.
