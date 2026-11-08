"use client";

import type { RestCallResult } from "@nextomic/integrations";
import type { JsonShape, RestCall, RestGroup } from "@nextomic/schema";
import { useCallback, useEffect, useState } from "react";
import {
  deleteApiCallAction,
  deleteApiGroupAction,
  getApiDataAction,
  saveApiCallAction,
  saveApiGroupAction,
  testApiCallAction
} from "@/app/(builder)/editor/[id]/api-data-actions";
import type { ApiDataSnapshot } from "@/server/connectors/rest-data";

export type ApiSelection = { kind: "call" | "group"; id: string; isNew?: boolean } | null;

/** Auth values typed in a form: blank keeps the saved value, null removes it. */
export type SecretDraft = Record<string, string | null>;

type Result = { error: string | null };

/** Loads API Data and saves groups and calls; every save returns the fresh snapshot. */
export function useApiData(projectId: string) {
  const [data, setData] = useState<ApiDataSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<ApiSelection>(null);
  const [newItem, setNewItem] = useState<RestCall | RestGroup | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    const result = await getApiDataAction(projectId);
    if (result.data) setData(result.data);
    else setLoadError(result.error);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const apply = (result: { data: ApiDataSnapshot | null; error: string | null }): Result => {
    if (result.data) {
      setData(result.data);
      setNewItem(null);
    }
    return { error: result.error };
  };

  return {
    data,
    loadError,
    reload,
    selection,
    newItem,
    select(next: ApiSelection, item: RestCall | RestGroup | null = null) {
      setSelection(next);
      setNewItem(item);
    },
    /** Saves a call; `saved` is the call as the server stored it (the editor's new baseline). */
    async saveCall(
      call: RestCall,
      secrets: SecretDraft,
      shape: JsonShape | null
    ): Promise<Result & { saved: RestCall | null }> {
      const response = await saveApiCallAction(projectId, call, secrets, shape);
      const result = apply(response);
      if (!result.error) setSelection({ kind: "call", id: call.id });
      return {
        ...result,
        saved: response.data?.config.calls.find((c) => c.id === call.id) ?? null
      };
    },
    async deleteCall(id: string): Promise<Result> {
      const result = apply(await deleteApiCallAction(projectId, id));
      if (!result.error) setSelection(null);
      return result;
    },
    async saveGroup(
      group: RestGroup,
      secrets: SecretDraft
    ): Promise<Result & { saved: RestGroup | null }> {
      const response = await saveApiGroupAction(projectId, group, secrets);
      const result = apply(response);
      if (!result.error) setSelection({ kind: "group", id: group.id });
      return {
        ...result,
        saved: response.data?.config.groups.find((g) => g.id === group.id) ?? null
      };
    },
    async deleteGroup(id: string): Promise<Result> {
      const result = apply(await deleteApiGroupAction(projectId, id));
      if (!result.error) setSelection(null);
      return result;
    },
    async test(
      params: Record<string, unknown>
    ): Promise<{ data: RestCallResult | null; error: string | null }> {
      return testApiCallAction(projectId, params);
    }
  };
}

export type ApiDataModel = ReturnType<typeof useApiData>;
