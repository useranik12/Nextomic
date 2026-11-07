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
