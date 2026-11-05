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

Config: `projectUrl`, `schema` (default `public`), `active` (toggle).
Secrets: `anonKey` / publishable key (required; masked in the UI, stored encrypted), `serviceRoleKey` (optional, server-side actions only).
Auth settings (public values): enabled providers and their client IDs, for example Google "Web Client ID". These only take effect when App Settings > Authentication is set to Supabase (see `app-auth.md`).

Capabilities:
- **Fetch Schema** (button): reads tables, views, columns, keys, and storage buckets and saves the STRUCTURE only. **Clear Schema** removes the saved structure (confirm first; warn about bindings that will break). Depending on the Supabase project's configuration, the anon key may not be allowed to read the full schema document. Verify current Supabase behavior. If access is insufficient, show clear guidance and offer an optional one-time service key input that is used for the fetch and discarded unless the owner opts in to store it encrypted.
- Tables & Views browser: searchable list, columns with Field Name, Data Type (Integer, DateTime, String, Boolean, and others), PostgreSQL type, primary key icon, and a star for fields flagged as used or favorite (flag is user metadata saved with the structure).
- CRUD resources: select (filters, order, limit, pagination), insert, update, delete, rpc.
- Auth for built apps: see `app-auth.md`.
- Storage: bucket list with object counts and Public/Private status, folder and object browsing, public URL with "Copy URL", signed URL. Persist only bucket names, public flags, and counts. Folder and object listings are fetched live on demand and never persisted.
- Bindings can pass the end user's JWT so the end project's own RLS applies.
- The "Active" toggle off hides the connector's resources from pickers and flags existing bindings as inactive (warning, not silent failure).

Rules:
- Default to the anon key. Use the service role key only when the user explicitly marks an action as "server-side only", and never expose it in generated client code.
- Generated client code reads keys from env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), never inline literals.
- Warn in UI when a table has RLS disabled (when detectable).

## 4. REST connector (the API Data page)
UI: see `ui-reference.md` 4.5 and `blueprint/pages/editor-api-data-*.png`.

Structure: **API groups** contain **API calls**. Calls can also be ungrouped.
- Group: `name`, `baseUrl` (https only; http allowed only for localhost in dev), shared `headers`, shared auth.
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
- Editing a connector with a blank secret field keeps the existing secret.

## 6. Proxy (`apps/editor` server route)
Pipeline for each call: authenticate (Better Auth session) → authorize (user belongs to project's workspace) → load connector → decrypt secrets → validate request with Zod → SSRF check → execute → normalize result.

Hard requirements:
- SSRF protection: resolve DNS, block private, loopback, link-local, and metadata ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7); re-check after redirects; limit redirects to 3.
- Timeouts (default 15s, max 30s), response size cap (default 5 MB), allowed content types.
- Per-user and per-project rate limits.
- Strip hop-by-hop headers and any attempt to override `Host` or auth headers outside the configured fields.
- Audit log entry per call: project, connector, resource, status, duration (no bodies, no secrets).

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
  | { type: "callResource"; binding: Extract<Binding, { kind: "resource" }>; onSuccess?: Action[]; onError?: Action[] }
  | { type: "setVariable"; scope: "page" | "app"; path: string; value: Binding }
  | { type: "navigate"; to: string; params?: Record<string, Binding> };
```

- Lists: a repeater component binds to a resource returning an array; child components bind to the item scope.
- Every resource binding must define loading, empty, and error UI.
- Publish step resolves bindings to generated fetch code that calls the end service directly (Supabase) or a generated server route (REST with secrets), never the builder proxy.

## 8. Platform tables (`packages/db`)
- `connectors`: id, project_id, type, name, active, config jsonb, secret_ciphertext, secret_iv, secret_tag, key_version, created_by, created_at, updated_at
- `connector_schemas`: id, connector_id, structure jsonb (tables, columns, types, buckets, or inferred response shapes; NO row data), fetched_at, hash
- `api_groups`: id, connector_id, name, base_url, headers jsonb, sort
- `api_calls`: id, group_id (nullable), connector_id, name, active, method, endpoint, headers jsonb, body_type, body_template, variables jsonb, advanced jsonb, response_schema jsonb, sort
- `connector_audit_log`: id, connector_id, user_id, resource_id, status, duration_ms, created_at
All rows are scoped by workspace through the project. Every query enforces workspace membership.

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
