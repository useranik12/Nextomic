"use server";

import type { RestCallResult } from "@nextomic/integrations";
import { z } from "zod";
import { authorizeProjectMember, failResult, type ActionResult } from "@/server/authorize";
import {
  deleteApiCall,
  deleteApiGroup,
  getApiData,
  saveApiCall,
  saveApiGroup,
  testApiCall,
  type ApiDataSnapshot
} from "@/server/connectors/rest-data";

// Server actions for the API Data page (Phase 4c). Every action signs the caller in and checks
// project access first; auth values come back only as masks.

const idSchema = z.string().min(1).max(64);

async function caller(projectId: string) {
  const { userId, workspaceId } = await authorizeProjectMember(projectId);
  return { userId, workspaceId, projectId };
}

export async function getApiDataAction(projectId: string): Promise<ActionResult<ApiDataSnapshot>> {
  try {
    await caller(projectId);
    return { data: await getApiData(projectId), error: null };
  } catch (error) {
    return failResult(error, "Could not load API Data.");
  }
}

export async function saveApiGroupAction(
  projectId: string,
  group: unknown,
  secrets: unknown
): Promise<ActionResult<ApiDataSnapshot>> {
  try {
    await saveApiGroup(await caller(projectId), group, secrets);
    return { data: await getApiData(projectId), error: null };
  } catch (error) {
    return failResult(error, "Could not save the API group.");
  }
}

export async function deleteApiGroupAction(
  projectId: string,
  groupId: string
): Promise<ActionResult<ApiDataSnapshot>> {
  try {
    await deleteApiGroup(await caller(projectId), idSchema.parse(groupId));
    return { data: await getApiData(projectId), error: null };
  } catch (error) {
    return failResult(error, "Could not delete the API group.");
  }
}

export async function saveApiCallAction(
  projectId: string,
  call: unknown,
  secrets: unknown,
  shape: unknown
): Promise<ActionResult<ApiDataSnapshot>> {
  try {
    await saveApiCall(await caller(projectId), call, secrets, shape);
    return { data: await getApiData(projectId), error: null };
  } catch (error) {
    return failResult(error, "Could not save the API call.");
  }
}

export async function deleteApiCallAction(
  projectId: string,
  callId: string
): Promise<ActionResult<ApiDataSnapshot>> {
  try {
    await deleteApiCall(await caller(projectId), idSchema.parse(callId));
    return { data: await getApiData(projectId), error: null };
  } catch (error) {
    return failResult(error, "Could not delete the API call.");
  }
}

/** Runs the call being edited with sample values; the request is validated by the connector. */
export async function testApiCallAction(
  projectId: string,
  params: Record<string, unknown>
): Promise<ActionResult<RestCallResult>> {
  try {
    return { data: await testApiCall(await caller(projectId), params), error: null };
  } catch (error) {
    return failResult(error, "The API call failed.");
  }
}
