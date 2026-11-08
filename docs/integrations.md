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

- **Fetch Schema** (button): reads PostgREST's OpenAPI 2.0 document at `GET /rest/v1/` with the anon key (tables, views, columns, types, primary and foreign keys from the `<pk/>` / `<fk .../>` markers, enum values, defaults, nullability, and `/rpc/*` functions with their parameters) plus the buckets from `GET /storage/v1/bucket`, and saves the STRUCTURE only in `connector_schemas`. A path with no write method is shown as a view (read only for this key). Fetch saves changed URL/key/schema fields first; creating the connection runs the test. **Schema** (field, default `public`): the database schema to fetch, sent as `Accept-Profile` (the schema must be exposed in Supabase's API settings). Each fetched schema is kept in the saved structure (`schemas: [{schema, tables, functions}]`, public first, then A to Z; buckets are project-wide); fetching a schema again replaces only that schema. Tables outside `public` are referenced as `schema.table` (Supabase Row types, queries), and every table/rpc request may carry its own `schema`. **Clear Schema** removes the schema named in the field (the buckets go when no schema is left) after a confirm that lists app state variables typed as Supabase Row.
- Tables & Views browser (the whole card is at most 700px tall, both sides scroll; Storage is 700px tall when it has buckets): searchable list sorted A to Z and grouped into Tables and Views; columns with Field Name, Data Type (the Nextomic type list, `[]` for lists, e.g. `String[]`), and the PostgreSQL type in PostgreSQL's short names (`timestamptz`, `timestamp`, `int8`, `float8`, `bool`, `varchar`, enum types without `public.`; `shortPgType`, applied again when showing schemas saved before this rule). Markers: key icon for a primary key, link icon for a foreign key with the target `table.column` under the name, red `*` after the name of a required (NOT NULL) column; hovering a marker says what it means.
- Enums: a column whose type is a Postgres enum shows its values and a "Save ENUM" button; the table header has "Save All Enums" when any column uses one. Saving creates the app enum (Data Types page) named after the Postgres type (`enumNameOf`: `public.role` becomes `role`, another schema's `billing.plan` becomes `billing_plan`, a reserved name gets `_enum`) with its values in order, or replaces the values of an app enum with that name. The button is disabled while the app enum already has exactly the same values in the same order.
- Status chip beside "Connection", checked live with the connection test when the page opens and after every change: green Connected, yellow Needs attention (turned off, or schema not fetched), red Failed (the test error on hover), grey Not connected. Fetch Schema reads "Refetch Schema" once a schema is saved.
- Type mapping (`nextomicTypeOf` in `packages/schema/src/supabase.ts`): smallint, integer and bigint are Int; real, double, numeric and money are Float; boolean is Boolean; timestamp, date and time types are Timestamptz; json and jsonb are JSON; everything else (text, varchar, uuid, enums) is String. `x[]` is a list of x.
- Execute (proxy `execute` op, server side): `select` (validated column names, `eq/neq/gt/gte/lt/lte/like/ilike/is/in` filters, order, limit up to 1000, offset), `insert`, `update` and `delete` (both need at least one filter), `rpc`, `storage.list` (one folder of a bucket) and `storage.sign` (a signed URL for one object, 60 to 3600 seconds, default 600). Resource ids: `table:<name>`, `view:<name>`, `rpc:<name>`, `bucket:<name>`.
- Storage: the bucket list shows what the anon key can see. Supabase returns only buckets the anon role may read (RLS on `storage.buckets`); when none come back, the page shows the policy to add (`create policy ... on storage.buckets for select to anon using (true)`). Persisted per bucket: name, public flag, and the top-level entry count (capped at 1000, shown as "1000+"). Folder listings are fetched live (connection must be on) and never saved. Public buckets show the public object URL with "Copy URL"; private bucket files are reached with signed URLs at run time. Double-clicking a file opens a preview (image, SVG, video, audio; other files show "Preview not available"); private bucket previews use a 10-minute signed URL made through the proxy (the anon role needs read access to the object). The preview is live and nothing is saved.
- Bindings pass the end user's JWT so the end project's own RLS applies (with queries, later in Phase 4). The JWT is sent by the runtime; it is never a dynamic data tag.
- The "Active" toggle off hides the connector's resources from pickers and flags existing bindings as inactive (warning, not silent failure). Turning it on runs the test first.
- "Supabase Row" in the type pickers lists the saved tables and views; it is disabled until a schema is fetched.

Rules:

- Generated client code reads keys from env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), never inline literals.
- RLS status is not visible to the anon key, so there is no RLS warning.

Built (4d): `packages/integrations/src/supabase/{connector,openapi,query}.ts`, `packages/schema/src/supabase.ts`, `apps/editor/src/server/connectors/supabase-schema.ts`, actions in `connector-actions.ts`, UI in `components/editor/supabase/*`. Tests: unit (parsing, mapping, request building, structure), a live check against a real project (`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`; skipped when unset) and `e2e/supabase.spec.ts`.

## 4. REST connector (the API Data page)

UI: see `ui-reference.md` 4.5 and `blueprint/pages/editor-api-data-*.png`; the Test API tab follows `blueprint/inspiration/ff-test-api-tab-part{1,2,3}.png` in Nextomic styling.

Built (4c, 2026-11-08): `packages/schema/src/{rest,json-path}.ts`, `packages/integrations/src/rest/{connector,request}.ts`, `apps/editor/src/server/connectors/rest-data.ts`, `app/(builder)/editor/[id]/api-data-actions.ts`, `components/editor/api-data/*`.

Storage: ONE REST connector per project, named "API Data" (type `rest`, always on). Its config holds every group and call (`restConfigSchema`); its sealed secrets hold the auth values under `<group or call id>.<field>`; `connector_schemas.structure` holds `{ calls: { <call id>: shape } }` (response STRUCTURE only). Every change (save or delete of one group or call) runs in a transaction that reads the row `FOR UPDATE`, so two people saving different calls never overwrite each other.

Structure: **API groups** contain **API calls**. Calls can also be ungrouped.

- Group: `name`, `baseUrl` (https; http and local hosts only with `ALLOW_PRIVATE_CONNECTOR_HOSTS` in development, see section 6), shared `headers`, shared `variables` (every call in the group can use them; a call's own variable with the same name wins), shared **authentication** (like Postman: None, Bearer token, Basic auth, API key in a header or query parameter), **Include credentials**.
- Call: `name`, `active`, `groupId` (null = ungrouped), `method` (GET, POST, PUT, PATCH, DELETE, OPTIONS, QUERY), `url` (the endpoint appended to the group base URL, or the full URL of an ungrouped call), `query` (query parameters as `key: value` lines, appended to the URL and encoded; a query string typed in the URL is kept and both are sent), `headers`, `bodyType` (`none | json | text | multipart | form`), `body` (JSON or text), `fields` (multipart and form), `variables`, `auth` (ungrouped calls only), `includeCredentials`, `response` (`parseAsDataType`, `dataTypeId`, `isList`, `jsonPaths`).
- An ungrouped call has every setting itself: full URL, headers, body, variables, authentication, advanced settings. A call moves into or out of a group with the Group select.
- Deleting a group keeps its calls as ungrouped calls with the group's URL, headers, variables, authentication (secrets copied) and Include credentials folded in.
- Method badge colors: GET green, POST purple, PUT orange, PATCH amber, DELETE pink/red, OPTIONS sky, QUERY teal. An inactive call shows a muted badge with a red x. GET and OPTIONS send no body; QUERY (the new safe method with a body) does.
- Advanced Settings holds one option only (owner decision): **Include credentials**. A group's setting applies to all its calls. It takes effect in built apps (the generated server route forwards the visitor's cookies, authorization and client certificates); the builder's Test tab has no visitor, so it does nothing there.

Secrets: tokens, passwords and API keys of an auth block are sealed (section 5) and come back only as masks. Changing the auth type drops the secrets the new type does not use. Plain header values are NOT secret: put keys in the authentication block or in a variable.

Placeholder syntax:

- One syntax everywhere: `[variable_name]` in the base URL, URL/endpoint, query keys and values, header values, JSON/text bodies and multipart/form field values. URL values are percent-encoded; query parameters are encoded by the URL builder.
- In JSON bodies a placeholder inside quotes is filled as escaped text, one outside quotes as a JSON value (number, true/false, list, object). `[true]`, `[false]` and `[null]` stay JSON arrays, so those three are not allowed as variable names.
- **Only variables, no dynamic data** (owner decision 2026-11-08, replaces the earlier `{{tags}}` in API inputs): the call's variables, its group's variables and the server-filled `jwt`/`user_ip`. Dynamic data is bound to a call's variables where the call is used (queries and actions, Phase 4e).
- Typing `[` adds the closing `]`, puts the caret between them and opens a list of the available variables with their type, default value and origin (Group, Server). The list filters as you type; ArrowUp/ArrowDown move, Enter or Tab insert, Escape closes. The Body tab also has chips that insert `[name]` at the caret. Names (call, group), the Variables table and authentication fields do not open the list.
- Header lines are entered as `key: value`; each line edits in place and its X clears it.
- A placeholder that is not defined in Variables (the call's or its group's) is a save error; a group's base URL and headers may use only the group's variables and the built-ins. The JSON body editor shows the first syntax problem with its line, a helper text, and a Format button that keeps placeholders.

Variables tab columns: Name, Type (the app's types: String, Int, Float, Boolean, JSON, Timestamptz, Color, URL, Enum, Data Type), Is List (True/False), Default Value, bolt (marks the variable as usually bound to dynamic data), delete, and "Add Variable".

Built-in variables (always available, not defined by the user): `jwt` (the signed-in end user's access token) and `user_ip` (the client IP from trusted proxy headers). Built apps resolve both on the server only and never accept them from the browser. The builder's Test tab is the one exception: it takes sample values typed by the project member testing the call, sent only to the builder's own proxy.

Test API tab:

- "Test API Call" runs the CURRENT draft (saved group and secrets, plus auth values typed but not saved for that call or its group) through the proxy (rate limit, audit, SSRF rules). Variables table: Name, Value, Include (unticked uses the default). Preview: API URL, request Headers (secrets shown as \*\*\*\*), Test Response (Body JSON, Raw Body, response Headers; `set-cookie` is never shown; body cut at 1 MB), and the status line (green success, red failure, latency). A 4xx/5xx answer is shown, not treated as an error.
- Response Type: "Parse as Data Type" (one app data type, or a list of it), and **JSON Paths**: JSON Path, Name, Response Preview (from the last test, never saved), Type, List, eye (picks the path for the response viewer: while any path is picked, Body JSON shows only the picked paths' values by name, with "Show whole response" to go back; the Response Preview column always stays), delete, "Add JSON Path". "Recommended" lists the top-level fields of the last response, each with its own "Add JSON Path".
- JSON path syntax (the builder reads responses with `JSON.parse`): `$` the response, `.name` or `["name"]` a field, `[2]` an item, `[:]` or `[*]` every item (the result is a flat list). Types are inferred when a path is added.
- Saving a call after a successful test saves the inferred response shape (structure only) for dynamic data and query fields. After a save the stored call becomes the editor's baseline, so Save turns off until the next change or test.
- Saved JSON paths are the call's named outputs: actions and query loops (4e) offer them by Name instead of a hand-written path. `jsonPathValues(paths, json)` (schema) reads them from a response by name.

Still to come: pagination presets, retries and caching options arrive with queries (4e).

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
