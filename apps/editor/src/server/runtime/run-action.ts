import { ConnectorError, type RestCallResult } from "@nextomic/integrations";
import {
  QueryInputError,
  findTable,
  storageActionCall,
  supabaseActionCall,
  supabaseStructureSchema,
  type ActionDef,
  type Params
} from "@nextomic/schema";
import { projectConnector, savedStructure, type Executor } from "../queries/run-query";

// Runs one server action of a built page (docs/dynamic-data-and-actions.md section 8.8). The
// params are the saved node's, with only the tag slots filled by the browser (`withActionValues`),
// so the table, columns, function and call are the owner's. The connector of the project does the
// work with its own keys; nothing here returns a secret.

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");
const rowsOf = (value: unknown): Record<string, string>[] =>
  Array.isArray(value) ? (value as Record<string, string>[]) : [];

/** The value an action returns into its output variable. */
export async function runServerAction(input: {
  projectId: string;
  def: ActionDef;
  params: Params;
  execute: Executor;
  /** Server-known values for REST built-ins. */
  userIp: string;
}): Promise<unknown> {
  const { projectId, def, params, execute } = input;
  try {
    if (def.type === "rest.call") return await runRestCall(input);
    if (def.type === "file.delete" || def.type === "file.download") {
      const row = await projectConnector(projectId, "supabase");
      if (!row) throw new ConnectorError("not_found", "Connect Supabase first.");
      const result = await execute(row, storageActionCall(def.type, params));
      return result.data ?? null;
    }
    const row = await projectConnector(projectId, "supabase");
    if (!row) throw new ConnectorError("not_found", "Connect Supabase first.");
    const structure = supabaseStructureSchema.safeParse(await savedStructure(row.id));
    const call = supabaseActionCall(
      def.type as Parameters<typeof supabaseActionCall>[0],
      params,
      (schema, table) => findTable(structure.success ? structure.data : null, schema, table)
    );
    const result = await execute(row, call);
    const data = result.data;
    // A single-row query and a row action that returned one row give that row; others give the list.
    if (def.type === "supabase.query" && params.single === "true")
      return Array.isArray(data) ? (data[0] ?? null) : data;
    return data ?? null;
  } catch (error) {
    if (error instanceof QueryInputError)
      throw new ConnectorError("invalid_request", error.message);
    throw error;
  }
}

async function runRestCall(input: {
  projectId: string;
  params: Params;
  execute: Executor;
  userIp: string;
}): Promise<unknown> {
  const row = await projectConnector(input.projectId, "rest");
  const callId = textOf(input.params.call);
  if (!row || !callId) throw new ConnectorError("not_found", "Choose a saved API call.");
  const values: Record<string, string> = {};
  for (const variable of rowsOf(input.params.variables))
    if (variable.name && variable.value) values[variable.name] = variable.value;
  const result = await input.execute(row, {
    resourceId: `call:${callId}`,
    params: { callId, values, builtIns: { jwt: "", user_ip: input.userIp }, secrets: {} }
  });
  const response = result.data as RestCallResult;
  if (!response.ok) throw new ConnectorError("upstream", `The API answered ${response.status}.`);
  return response.body.trim() === "" ? null : response.json;
}
