import { connectors, connectorSchemas, getDb } from "@nextomic/db";
import {
  ConnectorError,
  encryptSecrets,
  getConnector,
  maskSecret,
  mergeSecrets,
  type ConnectorType,
  type SecretMask,
  type TestResult
} from "@nextomic/integrations";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { platformKeyring } from "../keyring";
import { allowPrivateConnectorHosts } from "./env";
import { runOperation, storedSecrets, type StoredConnector } from "./operation";

// Saved connectors of a project. Every function takes a project id the caller has already
// authorized, and every query is scoped by it. Secrets leave this module only as masks.

export interface ConnectorSummary {
  id: string;
  type: ConnectorType;
  name: string;
  active: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, SecretMask>;
  schemaFetchedAt: string | null;
  updatedAt: string;
}

const idSchema = z.string().min(1).max(100);

export const saveConnectorInputSchema = z.object({
  id: idSchema.optional(),
  type: z.enum(["supabase", "rest"]),
  name: z.string().trim().min(1, "Give the connector a name.").max(80),
  active: z.boolean(),
  config: z.record(z.unknown()),
  /** Blank or missing keeps the saved value, null removes it. */
  secrets: z.record(z.string().max(20_000).nullable()).default({})
});

export type SaveConnectorInput = z.input<typeof saveConnectorInputSchema>;

export function toStored(row: typeof connectors.$inferSelect): StoredConnector {
  return {
    id: row.id,
    type: row.type,
    active: row.active,
    config: row.config,
    secretCiphertext: row.secretCiphertext,
    secretIv: row.secretIv,
    secretTag: row.secretTag,
    keyVersion: row.keyVersion
  };
}

export async function findConnector(projectId: string, connectorId: string) {
  const id = idSchema.parse(connectorId);
  const [row] = await getDb()
    .select()
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.projectId, projectId)))
    .limit(1);
  if (!row) throw new ConnectorError("not_found", "Connector not found.");
  return row;
}

export async function listConnectors(projectId: string): Promise<ConnectorSummary[]> {
  const rows = await getDb()
    .select({ connector: connectors, fetchedAt: connectorSchemas.fetchedAt })
    .from(connectors)
    .leftJoin(connectorSchemas, eq(connectorSchemas.connectorId, connectors.id))
    .where(eq(connectors.projectId, projectId))
    .orderBy(asc(connectors.createdAt));
  const keyring = () => platformKeyring();
  return rows.map(({ connector, fetchedAt }) => {
    const secrets = connector.secretCiphertext ? storedSecrets(toStored(connector), keyring) : {};
    return {
      id: connector.id,
      type: connector.type,
      name: connector.name,
      active: connector.active,
      config: connector.config,
      secrets: Object.fromEntries(Object.entries(secrets).map(([k, v]) => [k, maskSecret(v)])),
      schemaFetchedAt: fetchedAt?.toISOString() ?? null,
      updatedAt: connector.updatedAt.toISOString()
    };
  });
}

const isUniqueViolation = (error: unknown) =>
  (error as { code?: unknown; cause?: { code?: unknown } } | null)?.code === "23505" ||
  (error as { cause?: { code?: unknown } } | null)?.cause?.code === "23505";

/**
 * Creates or updates a connector. Config and the merged secrets are validated with the
 * connector's own schemas; turning a connector on requires its test to pass first.
 */
export async function saveConnector(
  projectId: string,
  workspaceId: string,
  userId: string,
  raw: SaveConnectorInput
): Promise<string> {
  const input = saveConnectorInputSchema.parse(raw);
  const connector = getConnector(input.type);
  if (!connector)
    throw new ConnectorError("invalid_config", "This connector type is not available yet.");
  const existing = input.id ? await findConnector(projectId, input.id) : null;
  if (existing && existing.type !== input.type)
    throw new ConnectorError("invalid_request", "A connector's type cannot change.");

  const config = connector.configSchema.safeParse(input.config);
  if (!config.success)
    throw new ConnectorError(
      "invalid_config",
      config.error.issues[0]?.message ?? "The settings are not valid."
    );
  const keyring = () => platformKeyring();
  const id = existing?.id ?? crypto.randomUUID();
  const secrets = mergeSecrets(
    existing ? storedSecrets(toStored(existing), keyring) : {},
    input.secrets
  );
  const checked = connector.secretsSchema.safeParse(secrets);
  if (!checked.success)
    throw new ConnectorError(
      "invalid_config",
      checked.error.issues[0]?.message ?? "The secrets are not valid."
    );
  const sealed = Object.keys(secrets).length > 0 ? encryptSecrets(secrets, id, keyring()) : null;
  const values = {
    name: input.name,
    active: input.active,
    config: config.data as Record<string, unknown>,
    secretCiphertext: sealed?.ciphertext ?? null,
    secretIv: sealed?.iv ?? null,
    secretTag: sealed?.tag ?? null,
    keyVersion: sealed?.keyVersion ?? null
  };

  if (input.active) {
    const result = (await runOperation(
      { id, type: input.type, ...values },
      { op: "test" },
      { projectId, workspaceId, allowPrivateHosts: allowPrivateConnectorHosts(), keyring }
    )) as TestResult;
    if (!result.ok)
      throw new ConnectorError("invalid_config", `The connection test failed: ${result.message}`);
  }

  try {
    if (existing)
      await getDb()
        .update(connectors)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(connectors.id, id), eq(connectors.projectId, projectId)));
    else
      await getDb()
        .insert(connectors)
        .values({ id, projectId, type: input.type, createdBy: userId, ...values });
  } catch (error) {
    if (isUniqueViolation(error))
      throw new ConnectorError("invalid_request", "Another connector already has this name.");
    throw error;
  }
  return id;
}

export async function deleteConnector(projectId: string, connectorId: string): Promise<void> {
  const row = await findConnector(projectId, connectorId);
  await getDb()
    .delete(connectors)
    .where(and(eq(connectors.id, row.id), eq(connectors.projectId, projectId)));
}
