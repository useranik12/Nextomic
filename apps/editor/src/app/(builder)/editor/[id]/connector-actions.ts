"use server";

import {
  authorizeProject,
  authorizeProjectMember,
  failResult,
  type ActionResult
} from "@/server/authorize";
import {
  deleteConnector,
  listConnectors,
  saveConnector,
  type ConnectorSummary,
  type SaveConnectorInput
} from "@/server/connectors/store";
import {
  browseSupabaseBucket,
  clearSupabaseSchema,
  fetchSupabaseSchema,
  getSupabaseSchema,
  setSupabaseFavorite,
  type SavedSupabaseSchema
} from "@/server/connectors/supabase-schema";
import type { StorageEntry } from "@nextomic/integrations";

// Server actions for the Supabase (4d) and API Data (4c) pages. Secrets come back only as masks.

export async function listConnectorsAction(
  projectId: string
): Promise<ActionResult<ConnectorSummary[]>> {
  try {
    await authorizeProject(projectId);
    return { data: await listConnectors(projectId), error: null };
  } catch (error) {
    return failResult(error, "Could not load the connectors.");
  }
}

export async function saveConnectorAction(
  projectId: string,
  input: SaveConnectorInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const { userId, workspaceId } = await authorizeProjectMember(projectId);
    const id = await saveConnector(projectId, workspaceId, userId, input);
    return { data: { id }, error: null };
  } catch (error) {
    return failResult(error, "Could not save the connector.");
  }
}

export async function deleteConnectorAction(
  projectId: string,
  connectorId: string
): Promise<ActionResult<null>> {
  try {
    await authorizeProject(projectId);
    await deleteConnector(projectId, connectorId);
    return { data: null, error: null };
  } catch (error) {
    return failResult(error, "Could not delete the connector.");
  }
}

// Supabase page (4d). One Supabase connection per project, named "Supabase".

export interface SupabasePageData {
  connector: ConnectorSummary | null;
  schema: SavedSupabaseSchema | null;
}

export async function getSupabasePageAction(
  projectId: string
): Promise<ActionResult<SupabasePageData>> {
  try {
    await authorizeProject(projectId);
    const connector = (await listConnectors(projectId)).find((c) => c.type === "supabase") ?? null;
    const schema = connector ? await getSupabaseSchema(projectId, connector.id) : null;
    return { data: { connector, schema }, error: null };
  } catch (error) {
    return failResult(error, "Could not load the Supabase connection.");
  }
}

export async function fetchSupabaseSchemaAction(
  projectId: string,
  connectorId: string
): Promise<ActionResult<SavedSupabaseSchema>> {
  try {
    const { userId, workspaceId } = await authorizeProjectMember(projectId);
    return {
      data: await fetchSupabaseSchema({ userId, workspaceId, projectId }, connectorId),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not fetch the schema.");
  }
}

export async function clearSupabaseSchemaAction(
  projectId: string,
  connectorId: string
): Promise<ActionResult<null>> {
  try {
    await authorizeProject(projectId);
    await clearSupabaseSchema(projectId, connectorId);
    return { data: null, error: null };
  } catch (error) {
    return failResult(error, "Could not clear the schema.");
  }
}

export async function setSupabaseFavoriteAction(
  projectId: string,
  connectorId: string,
  input: { table: string; column: string; starred: boolean }
): Promise<ActionResult<Record<string, string[]>>> {
  try {
    await authorizeProject(projectId);
    return { data: await setSupabaseFavorite(projectId, connectorId, input), error: null };
  } catch (error) {
    return failResult(error, "Could not save the star.");
  }
}

export async function browseSupabaseBucketAction(
  projectId: string,
  connectorId: string,
  bucket: string,
  prefix: string
): Promise<ActionResult<StorageEntry[]>> {
  try {
    const { userId, workspaceId } = await authorizeProjectMember(projectId);
    return {
      data: await browseSupabaseBucket(
        { userId, workspaceId, projectId },
        connectorId,
        bucket,
        prefix
      ),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not list the bucket.");
  }
}
