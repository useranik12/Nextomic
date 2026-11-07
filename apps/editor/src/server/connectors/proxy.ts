import { connectorAuditLog, getDb } from "@nextomic/db";
import { ConnectorError, normalizeError, type NormalizedError } from "@nextomic/integrations";
import { createRateLimiter } from "../rate-limit";
import { platformKeyring } from "../keyring";
import { allowPrivateConnectorHosts } from "./env";
import { operationSchema, runOperation, type OperationData } from "./operation";
import { findConnector, toStored } from "./store";

// The connector proxy (docs/integrations.md section 6). The route has already signed the caller
// in and checked project membership; this step limits the rate, loads the connector, validates
// the request, runs it and writes one audit row without bodies or secrets.

const PER_USER = createRateLimiter(60, 60_000);
const PER_PROJECT = createRateLimiter(300, 60_000);

export type ProxyResult = { ok: true; data: OperationData } | { ok: false; error: NormalizedError };

export interface ProxyCaller {
  userId: string;
  projectId: string;
  workspaceId: string;
}

function checkRate(caller: ProxyCaller) {
  const user = PER_USER.take(`user:${caller.userId}`);
  const project = PER_PROJECT.take(`project:${caller.projectId}`);
  const blocked = !user.ok ? user : !project.ok ? project : null;
  if (blocked)
    throw new ConnectorError("rate_limited", "Too many connector calls. Try again shortly.", {
      details: { retryAfterSeconds: Math.ceil(blocked.retryAfterMs / 1000) }
    });
}

async function audit(entry: typeof connectorAuditLog.$inferInsert) {
  try {
    await getDb().insert(connectorAuditLog).values(entry);
  } catch {
    // The call already ran; a failed audit write must not change its outcome.
  }
}

export async function proxyConnectorCall(
  caller: ProxyCaller,
  connectorId: string,
  body: unknown
): Promise<ProxyResult> {
  const started = performance.now();
  let connectorFound: string | null = null;
  let operation: "test" | "resources" | "execute" = "execute";
  let resourceId: string | null = null;
  try {
    checkRate(caller);
    const parsed = operationSchema.safeParse(body);
    if (!parsed.success) throw new ConnectorError("invalid_request", "The request is not valid.");
    operation = parsed.data.op;
    resourceId = parsed.data.op === "execute" ? parsed.data.request.resourceId : null;
    const row = await findConnector(caller.projectId, connectorId);
    connectorFound = row.id;
    const data = await runOperation(toStored(row), parsed.data, {
      projectId: caller.projectId,
      workspaceId: caller.workspaceId,
      allowPrivateHosts: allowPrivateConnectorHosts(),
      keyring: platformKeyring
    });
    const status = operation === "execute" ? String((data as { status: number }).status) : "ok";
    await audit({
      connectorId: row.id,
      userId: caller.userId,
      operation,
      resourceId,
      status,
      durationMs: Math.round(performance.now() - started)
    });
    return { ok: true, data };
  } catch (error) {
    const normalized = normalizeError(error);
    if (connectorFound)
      await audit({
        connectorId: connectorFound,
        userId: caller.userId,
        operation,
        resourceId,
        status: normalized.code,
        durationMs: Math.round(performance.now() - started)
      });
    return { ok: false, error: normalized };
  }
}
