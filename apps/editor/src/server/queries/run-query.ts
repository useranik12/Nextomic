import { connectors, connectorSchemas, getDb, projects } from "@nextomic/db";
import { ConnectorError, type ExecuteResult, type RestCallResult } from "@nextomic/integrations";
import {
  callVariables,
  collectLoopRows,
  expressionScope,
  findTable,
  loopInstances,
  QueryInputError,
  restConfigSchema,
  restQueryValues,
  restRows,
  supabaseQueryRequest,
  supabaseRows,
  supabaseStructureSchema,
  type DynamicContext,
  type ElementNode,
  type ElementQuery,
  type LoopRows,
  type QueryRows,
  type RestConfig,
  type SupabaseStructure
} from "@nextomic/schema";
import { and, eq } from "drizzle-orm";
import { allowPrivateConnectorHosts } from "../connectors/env";
import { runOperation } from "../connectors/operation";
import { proxyConnectorCall, type ProxyCaller } from "../connectors/proxy";
import { toStored } from "../connectors/store";
import { platformKeyring } from "../keyring";

// Runs an element's query loop (docs/dynamic-data-and-actions.md section 3). The query and its
// filled templates come in; rows go out and are never stored. The editor canvas runs through the
// connector proxy (member, rate limit, audit); the published site's server render runs the
// connector directly, because no builder member is involved.

type Row = typeof connectors.$inferSelect;
export type ConnectorRequest = { resourceId: string; params: Record<string, unknown> };
export type Executor = (row: Row, request: ConnectorRequest) => Promise<ExecuteResult>;

async function projectConnector(projectId: string, type: "supabase" | "rest"): Promise<Row | null> {
  const [row] = await getDb()
    .select()
    .from(connectors)
    .where(and(eq(connectors.projectId, projectId), eq(connectors.type, type)))
    .limit(1);
  return row ?? null;
}

async function savedStructure(connectorId: string): Promise<unknown> {
  const [row] = await getDb()
    .select({ structure: connectorSchemas.structure })
    .from(connectorSchemas)
    .where(eq(connectorSchemas.connectorId, connectorId))
    .limit(1);
  return row?.structure ?? null;
}

/** Runs through the connector proxy as a project member (editor canvas). */
export const editorExecutor =
  (caller: ProxyCaller): Executor =>
  async (row, request) => {
    const result = await proxyConnectorCall(caller, row.id, { op: "execute", request });
    if (!result.ok) throw new ConnectorError(result.error.code, result.error.message);
    return result.data as ExecuteResult;
  };

/** Runs the connector on the server for a published page (no builder member). */
export const siteExecutor =
  (projectId: string, workspaceId: string): Executor =>
  async (row, request) =>
    (await runOperation(
      toStored(row),
      { op: "execute", request },
      {
        projectId,
        workspaceId,
        allowPrivateHosts: allowPrivateConnectorHosts(),
        keyring: platformKeyring
      }
    )) as ExecuteResult;

export interface RunQueryInput {
  projectId: string;
  query: ElementQuery;
  fill: (template: string) => string;
  offset?: number;
  /** Server-filled REST values for the visitor (built apps); empty in the editor. */
  builtIns?: { jwt: string; user_ip: string };
  execute: Executor;
}

async function runSupabase(input: RunQueryInput): Promise<QueryRows> {
  const row = await projectConnector(input.projectId, "supabase");
  if (!row) throw new ConnectorError("not_found", "Connect Supabase first.");
  const structure = supabaseStructureSchema.safeParse(await savedStructure(row.id));
  const { schema, table: name } = input.query.supabase;
  const table = findTable(structure.success ? structure.data : null, schema, name);
  if (!table) throw new ConnectorError("invalid_request", `Fetch the schema that has "${name}".`);
  const request = supabaseQueryRequest(input.query.supabase, table, input.fill, input.offset);
  const result = await input.execute(row, request);
  return supabaseRows(input.query.supabase, result.data);
}

async function runRest(input: RunQueryInput): Promise<QueryRows> {
  const row = await projectConnector(input.projectId, "rest");
  const config = restConfigSchema.safeParse(row?.config);
  const call = config.success
    ? config.data.calls.find((c) => c.id === input.query.rest.callId)
    : undefined;
  if (!row || !call) throw new ConnectorError("not_found", "Choose a saved API call.");
  const group = config.success
    ? (config.data.groups.find((g) => g.id === call.groupId) ?? null)
    : null;
  const result = await input.execute(row, {
    resourceId: `call:${call.id}`,
    params: {
      callId: call.id,
      values: restQueryValues(input.query.rest, callVariables(call, group), input.fill),
      builtIns: input.builtIns ?? { jwt: "", user_ip: "" },
      secrets: {}
    }
  });
  const response = result.data as RestCallResult;
  if (!response.ok) throw new ConnectorError("upstream", `The API answered ${response.status}.`);
  const json = response.body.trim() === "" ? [] : response.json;
  return restRows(input.query.rest, call, json, input.offset);
}

/** The rows of a query loop. Bad filled values become a request error, not a crash. */
export async function runElementQuery(input: RunQueryInput): Promise<QueryRows> {
  try {
    return input.query.source === "supabase" ? await runSupabase(input) : await runRest(input);
  } catch (error) {
    if (error instanceof QueryInputError)
      throw new ConnectorError("invalid_request", error.message);
    throw error;
  }
}

/** The saved Supabase structure (with the connection's on/off state) and the API Data calls. */
export async function querySources(projectId: string): Promise<{
  supabase: { active: boolean; structure: SupabaseStructure | null } | null;
  rest: RestConfig;
}> {
  const [supabase, rest] = await Promise.all([
    projectConnector(projectId, "supabase"),
    projectConnector(projectId, "rest")
  ]);
  const structure = supabase
    ? supabaseStructureSchema.safeParse(await savedStructure(supabase.id))
    : null;
  const config = restConfigSchema.safeParse(rest?.config);
  return {
    supabase: supabase
      ? { active: supabase.active, structure: structure?.success ? structure.data : null }
      : null,
    rest: config.success ? config.data : restConfigSchema.parse({})
  };
}

/** Most query loop runs one page render makes (nested loops run once per outer row). */
export const MAX_LOOP_RUNS = 100;

/**
 * The rows of every query loop on a page, for the server render. Templates are filled here from
 * the page's dynamic context, so nothing a browser sent is evaluated. Pages without query loops
 * cost nothing.
 */
export async function pageLoopRows(input: {
  projectId: string;
  tree: ElementNode;
  dynamic: DynamicContext;
  execute: Executor;
}): Promise<LoopRows> {
  if (loopInstances(input.tree, {}, 1).length === 0) return {};
  return collectLoopRows(
    input.tree,
    expressionScope(input.dynamic),
    (instance, fill) =>
      runElementQuery({
        projectId: input.projectId,
        query: instance.query,
        fill,
        execute: input.execute
      }),
    MAX_LOOP_RUNS
  );
}

/** The workspace a project belongs to (published pages run connectors in its name). */
export async function projectWorkspaceId(projectId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.workspaceId ?? null;
}
