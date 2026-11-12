import type { ZodType } from "zod";

export type ConnectorType = "supabase" | "rest";

export interface ConnectorContext {
  projectId: string;
  workspaceId: string;
  signal: AbortSignal;
  /** Lets local and private addresses through the SSRF guard (development only). */
  allowPrivateHosts: boolean;
}

export interface TestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

/** Something a connector exposes: a table, view, endpoint, bucket or auth action. */
export interface Resource {
  id: string;
  kind: string;
  name: string;
  /** Structure only (columns, types, response shape). Never row data. */
  structure?: unknown;
}

export interface ExecuteRequest {
  resourceId: string;
  params: Record<string, unknown>;
  /** The signed-in visitor's access token: Supabase runs the request as them (RLS). Server-set. */
  userToken?: string;
}

export interface ExecuteResult {
  status: number;
  data: unknown;
}

export interface Connector<TConfig, TSecrets> {
  readonly type: ConnectorType;
  configSchema: ZodType<TConfig>;
  secretsSchema: ZodType<TSecrets>;
  test(cfg: TConfig, secrets: TSecrets, ctx: ConnectorContext): Promise<TestResult>;
  listResources(cfg: TConfig, secrets: TSecrets, ctx: ConnectorContext): Promise<Resource[]>;
  execute(
    cfg: TConfig,
    secrets: TSecrets,
    req: ExecuteRequest,
    ctx: ConnectorContext
  ): Promise<ExecuteResult>;
}
