import { connectors, connectorSchemas, getDb } from "@nextomic/db";
import {
  ConnectorError,
  encryptSecrets,
  maskSecret,
  mergeSecrets,
  type RestCallResult,
  type SecretMask
} from "@nextomic/integrations";
import {
  AUTH_SECRET_FIELDS,
  callProblems,
  joinUrl,
  restCallSchema,
  restConfigSchema,
  restGroupSchema,
  type JsonShape,
  type RestAuth,
  type RestCall,
  type RestConfig,
  type RestGroup
} from "@nextomic/schema";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { platformKeyring } from "../keyring";
import { storedSecrets } from "./operation";
import { proxyConnectorCall, type ProxyCaller } from "./proxy";
import { toStored } from "./store";

// API Data (docs/integrations.md section 4): the project's one REST connector. Every change reads
// the row FOR UPDATE inside a transaction, applies one group or call, validates the whole config
// and seals the secrets again, so two people saving different calls never overwrite each other.

export const API_DATA_NAME = "API Data";

export interface ApiDataSnapshot {
  connectorId: string | null;
  config: RestConfig;
  /** Masks of the saved auth values, keyed `<group or call id>.<field>`. */
  secrets: Record<string, SecretMask>;
  /** Saved response shapes by call id (structure only). */
  shapes: Record<string, JsonShape>;
}

const shapeSchema: z.ZodType<JsonShape> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal("object"), fields: z.record(z.string().max(500), shapeSchema) }),
    z.object({ kind: z.literal("list"), item: shapeSchema.nullable() }),
    z.object({ kind: z.enum(["string", "int", "float", "boolean", "null"]) })
  ])
);
const shapesSchema = z.object({ calls: z.record(z.string().max(64), shapeSchema).default({}) });

/** Secrets a form may send for one owner: blank keeps, null removes. */
export const secretsInputSchema = z.record(z.string().max(200), z.string().max(20_000).nullable());

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Row = typeof connectors.$inferSelect;

async function findRow(db: Tx | ReturnType<typeof getDb>, projectId: string, lock: boolean) {
  const query = db
    .select()
    .from(connectors)
    .where(and(eq(connectors.projectId, projectId), eq(connectors.type, "rest")))
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

const openSecrets = (row: Row | null) =>
  row?.secretCiphertext ? storedSecrets(toStored(row), () => platformKeyring()) : {};

async function readShapes(connectorId: string): Promise<Record<string, JsonShape>> {
  const [row] = await getDb()
    .select({ structure: connectorSchemas.structure })
    .from(connectorSchemas)
    .where(eq(connectorSchemas.connectorId, connectorId))
    .limit(1);
  const parsed = shapesSchema.safeParse(row?.structure);
  return parsed.success ? parsed.data.calls : {};
}

export async function getApiData(projectId: string): Promise<ApiDataSnapshot> {
  const row = await findRow(getDb(), projectId, false);
  if (!row)
    return { connectorId: null, config: restConfigSchema.parse({}), secrets: {}, shapes: {} };
  const config = restConfigSchema.safeParse(row.config);
  const secrets = openSecrets(row);
  return {
    connectorId: row.id,
    config: config.success ? config.data : restConfigSchema.parse({}),
    secrets: Object.fromEntries(Object.entries(secrets).map(([k, v]) => [k, maskSecret(v)])),
    shapes: await readShapes(row.id)
  };
}

interface Change {
  config: RestConfig;
  secrets: Record<string, string>;
  /** Shapes to set (a shape) or drop (null) by call id. */
  shapes?: Record<string, JsonShape | null>;
}

/** Runs one change on the project's API Data under a row lock, creating the connector if needed. */
async function mutate(
  caller: ProxyCaller,
  change: (config: RestConfig, secrets: Record<string, string>) => Change
): Promise<string> {
  return getDb().transaction(async (tx) => {
    const row = await findRow(tx, caller.projectId, true);
    const current = row ? restConfigSchema.parse(row.config) : restConfigSchema.parse({});
    const next = change(current, openSecrets(row));
    const config = restConfigSchema.parse(next.config);
    const id = row?.id ?? crypto.randomUUID();
    const sealed =
      Object.keys(next.secrets).length > 0
        ? encryptSecrets(next.secrets, id, platformKeyring())
        : null;
    const values = {
      config: config as unknown as Record<string, unknown>,
      secretCiphertext: sealed?.ciphertext ?? null,
      secretIv: sealed?.iv ?? null,
      secretTag: sealed?.tag ?? null,
      keyVersion: sealed?.keyVersion ?? null
    };
    if (row)
      await tx
        .update(connectors)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(connectors.id, id));
    else
      await tx.insert(connectors).values({
        id,
        projectId: caller.projectId,
        type: "rest",
        name: API_DATA_NAME,
        active: true,
        createdBy: caller.userId,
        ...values
      });
    if (next.shapes && Object.keys(next.shapes).length > 0) {
      const [saved] = await tx
        .select({ structure: connectorSchemas.structure })
        .from(connectorSchemas)
        .where(eq(connectorSchemas.connectorId, id));
      const parsed = shapesSchema.safeParse(saved?.structure);
      const calls = { ...(parsed.success ? parsed.data.calls : {}) };
      for (const [callId, shape] of Object.entries(next.shapes))
        if (shape) calls[callId] = shape;
        else delete calls[callId];
      const structure = { calls };
      const hash = createHash("sha256").update(JSON.stringify(structure)).digest("hex");
      await tx
        .insert(connectorSchemas)
        .values({ connectorId: id, structure, hash, fetchedAt: new Date() })
        .onConflictDoUpdate({
          target: connectorSchemas.connectorId,
          set: { structure, hash, fetchedAt: new Date() }
        });
    }
    return id;
  });
}

/** Keeps only the secrets an auth block of this type can have for this owner. */
function ownerSecrets(
  all: Record<string, string>,
  ownerId: string,
  auth: RestAuth,
  incoming: Record<string, string | null>
): Record<string, string> {
  const allowed = new Set(AUTH_SECRET_FIELDS[auth.type].map((f) => `${ownerId}.${f}`));
  const own = Object.fromEntries(Object.entries(incoming).filter(([k]) => allowed.has(k)));
  const merged = mergeSecrets(all, own);
  return Object.fromEntries(
    Object.entries(merged).filter(([k]) => !k.startsWith(`${ownerId}.`) || allowed.has(k))
  );
}

const dropOwner = (all: Record<string, string>, ownerId: string) =>
  Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith(`${ownerId}.`)));

export async function saveApiGroup(
  caller: ProxyCaller,
  raw: unknown,
  rawSecrets: unknown
): Promise<string> {
  const group = restGroupSchema.parse(raw);
  const incoming = secretsInputSchema.parse(rawSecrets);
  if (group.baseUrl && !/^https?:\/\//i.test(group.baseUrl))
    throw new ConnectorError("invalid_request", "The base URL must start with https://.");
  await mutate(caller, (config, secrets) => ({
    config: {
      ...config,
      groups: config.groups.some((g) => g.id === group.id)
        ? config.groups.map((g) => (g.id === group.id ? group : g))
        : [...config.groups, group]
    },
    secrets: ownerSecrets(secrets, group.id, group.auth, incoming)
  }));
  return group.id;
}

/** Deletes a group; its calls become ungrouped with the group's URL, headers and auth copied in. */
export async function deleteApiGroup(caller: ProxyCaller, groupId: string): Promise<void> {
  await mutate(caller, (config, secrets) => {
    const group = config.groups.find((g) => g.id === groupId);
    if (!group) throw new ConnectorError("not_found", "This API group does not exist.");
    let next = dropOwner(secrets, group.id);
    const calls = config.calls.map((call) => {
      if (call.groupId !== group.id) return call;
      for (const field of AUTH_SECRET_FIELDS[group.auth.type]) {
        const value = secrets[`${group.id}.${field}`];
        if (value) next = { ...next, [`${call.id}.${field}`]: value };
      }
      return ungroup(call, group);
    });
    return {
      config: { groups: config.groups.filter((g) => g.id !== groupId), calls },
      secrets: next
    };
  });
}

const ungroup = (call: RestCall, group: RestGroup): RestCall => ({
  ...call,
  groupId: null,
  url: joinUrl(group.baseUrl, call.url),
  headers: [
    ...group.headers.filter(
      (h) => !call.headers.some((c) => c.key.toLowerCase() === h.key.toLowerCase())
    ),
    ...call.headers
  ],
  auth: group.auth,
  includeCredentials: call.includeCredentials || group.includeCredentials
});

export async function saveApiCall(
  caller: ProxyCaller,
  raw: unknown,
  rawSecrets: unknown,
  rawShape: unknown
): Promise<string> {
  const call = restCallSchema.parse(raw);
  const incoming = secretsInputSchema.parse(rawSecrets);
  const shape =
    rawShape === undefined || rawShape === null ? undefined : shapeSchema.parse(rawShape);
  await mutate(caller, (config, secrets) => {
    const group = call.groupId ? (config.groups.find((g) => g.id === call.groupId) ?? null) : null;
    if (call.groupId && !group)
      throw new ConnectorError("invalid_request", "The call's API group does not exist.");
    const problem = callProblems(call, group)[0];
    if (problem) throw new ConnectorError("invalid_request", problem);
    const calls = config.calls.some((c) => c.id === call.id)
      ? config.calls.map((c) => (c.id === call.id ? call : c))
      : [...config.calls, call];
    // A grouped call has no auth of its own, so it keeps no secrets.
    const auth: RestAuth = group ? { ...call.auth, type: "none" } : call.auth;
    return {
      config: { ...config, calls },
      secrets: ownerSecrets(secrets, call.id, auth, group ? {} : incoming),
      ...(shape ? { shapes: { [call.id]: shape } } : {})
    };
  });
  return call.id;
}

export async function deleteApiCall(caller: ProxyCaller, callId: string): Promise<void> {
  await mutate(caller, (config, secrets) => ({
    config: { ...config, calls: config.calls.filter((c) => c.id !== callId) },
    secrets: dropOwner(secrets, callId),
    shapes: { [callId]: null }
  }));
}

/** Runs an API call (usually the unsaved draft) through the proxy: rate limit, audit, SSRF rules. */
export async function testApiCall(caller: ProxyCaller, params: Record<string, unknown>) {
  let row = await findRow(getDb(), caller.projectId, false);
  if (!row) {
    await mutate(caller, (config, secrets) => ({ config, secrets }));
    row = await findRow(getDb(), caller.projectId, false);
  }
  if (!row) throw new ConnectorError("internal", "Could not prepare API Data.");
  const result = await proxyConnectorCall(caller, row.id, {
    op: "execute",
    request: { resourceId: "call:test", params }
  });
  if (!result.ok) throw new ConnectorError(result.error.code, result.error.message);
  return (result.data as { data: RestCallResult }).data;
}
