import {
  ConnectorError,
  decryptSecrets,
  getConnector,
  MAX_TIMEOUT_MS,
  type ConnectorType,
  type ExecuteResult,
  type Keyring,
  type Resource,
  type TestResult
} from "@nextomic/integrations";
import { z } from "zod";

// One connector operation, after the caller is signed in and allowed on the project: open the
// secrets, validate config and secrets with the connector's own schemas, then run it. The
// connector reaches the network only through safeFetch, which applies the SSRF rules.

export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("test") }),
  z.object({ op: z.literal("resources") }),
  z.object({
    op: z.literal("execute"),
    request: z.object({
      resourceId: z.string().min(1).max(200),
      params: z.record(z.unknown())
    })
  })
]);

export type Operation = z.infer<typeof operationSchema>;
export type OperationData = TestResult | Resource[] | ExecuteResult;

/** The stored fields of a connector row this step needs. */
export interface StoredConnector {
  id: string;
  type: ConnectorType;
  active: boolean;
  config: Record<string, unknown>;
  secretCiphertext: string | null;
  secretIv: string | null;
  secretTag: string | null;
  keyVersion: number | null;
}

export interface OperationContext {
  projectId: string;
  workspaceId: string;
  allowPrivateHosts: boolean;
  keyring: () => Keyring;
}

export function storedSecrets(
  row: StoredConnector,
  keyring: () => Keyring
): Record<string, string> {
  if (!row.secretCiphertext || !row.secretIv || !row.secretTag || row.keyVersion === null)
    return {};
  return decryptSecrets(
    {
      ciphertext: row.secretCiphertext,
      iv: row.secretIv,
      tag: row.secretTag,
      keyVersion: row.keyVersion
    },
    row.id,
    keyring()
  );
}

export async function runOperation(
  row: StoredConnector,
  operation: Operation,
  ctx: OperationContext
): Promise<OperationData> {
  const connector = getConnector(row.type);
  if (!connector)
    throw new ConnectorError("invalid_config", "This connector type is not available.");
  if (operation.op === "execute" && !row.active)
    throw new ConnectorError("invalid_request", "This connector is turned off.");
  const config = connector.configSchema.safeParse(row.config);
  if (!config.success)
    throw new ConnectorError("invalid_config", "The connector settings are not valid.");
  const secrets = connector.secretsSchema.safeParse(storedSecrets(row, ctx.keyring));
  if (!secrets.success)
    throw new ConnectorError("invalid_config", "The connector secrets are incomplete.");
  const signal = AbortSignal.timeout(MAX_TIMEOUT_MS);
  const context = {
    projectId: ctx.projectId,
    workspaceId: ctx.workspaceId,
    allowPrivateHosts: ctx.allowPrivateHosts,
    signal
  };
  if (operation.op === "test") return connector.test(config.data, secrets.data, context);
  if (operation.op === "resources")
    return connector.listResources(config.data, secrets.data, context);
  return connector.execute(config.data, secrets.data, operation.request, context);
}
