"use client";

import type { SupabaseStructure } from "@nextomic/schema";
import { useCallback, useEffect, useState } from "react";
import {
  clearSupabaseSchemaAction,
  fetchSupabaseSchemaAction,
  getSupabasePageAction,
  saveConnectorAction,
  setSupabaseFavoriteAction,
  type SupabasePageData
} from "@/app/(builder)/editor/[id]/connector-actions";
import { useSupabaseTables } from "./supabase-store";

export interface SupabaseAuthConfig {
  google: { enabled: boolean; webClientId: string };
}

export interface ConnectionDraft {
  projectUrl: string;
  /** Blank keeps the saved key. */
  anonKey: string;
}

export const DEFAULT_AUTH: SupabaseAuthConfig = { google: { enabled: false, webClientId: "" } };

type Result<T> = { data: T; error: null } | { data: null; error: string };

/** The saved auth settings of a connector config, with defaults for anything missing. */
export function authOf(config: Record<string, unknown> | undefined): SupabaseAuthConfig {
  const google = (config?.auth as { google?: Partial<SupabaseAuthConfig["google"]> } | undefined)
    ?.google;
  return {
    google: {
      enabled: google?.enabled === true,
      webClientId: typeof google?.webClientId === "string" ? google.webClientId : ""
    }
  };
}

/** Loads the Supabase connection and its saved schema, and runs every change on the page. */
export function useSupabasePage(projectId: string) {
  const [data, setData] = useState<SupabasePageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const setTables = useSupabaseTables((s) => s.setTables);

  const reload = useCallback(async () => {
    const result = await getSupabasePageAction(projectId);
    if (result.data === null) return setLoadError(result.error);
    setLoadError(null);
    setData(result.data);
    setTables(result.data.schema?.structure.tables.map((t) => t.name) ?? []);
  }, [projectId, setTables]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connector = data?.connector ?? null;

  /** Creates or updates the connection. Turning it on (or creating it) runs the test first. */
  async function save(input: {
    draft?: ConnectionDraft;
    active?: boolean;
    auth?: SupabaseAuthConfig;
  }): Promise<Result<string>> {
    const config = connector?.config ?? {};
    const result = await saveConnectorAction(projectId, {
      ...(connector ? { id: connector.id } : {}),
      type: "supabase",
      name: "Supabase",
      active: input.active ?? connector?.active ?? true,
      config: {
        projectUrl: input.draft?.projectUrl ?? config.projectUrl ?? "",
        schema: typeof config.schema === "string" ? config.schema : "public",
        auth: input.auth ?? authOf(config)
      },
      secrets: input.draft?.anonKey ? { anonKey: input.draft.anonKey } : {}
    });
    if (result.data === null) return result;
    await reload();
    return { data: result.data.id, error: null };
  }

  async function fetchSchema(connectorId: string): Promise<Result<null>> {
    const result = await fetchSupabaseSchemaAction(projectId, connectorId);
    if (result.data === null) return result;
    await reload();
    return { data: null, error: null };
  }

  async function clearSchema(): Promise<Result<null>> {
    if (!connector) return { data: null, error: null };
    const result = await clearSupabaseSchemaAction(projectId, connector.id);
    if (result.data === null && result.error) return result;
    await reload();
    return { data: null, error: null };
  }

  async function setFavorite(
    table: string,
    column: string,
    starred: boolean
  ): Promise<string | null> {
    if (!connector || !data?.schema) return null;
    const result = await setSupabaseFavoriteAction(projectId, connector.id, {
      table,
      column,
      starred
    });
    if (result.data === null) return result.error;
    const structure: SupabaseStructure = { ...data.schema.structure, favorites: result.data };
    setData({ ...data, schema: { ...data.schema, structure } });
    return null;
  }

  return { data, loadError, reload, connector, save, fetchSchema, clearSchema, setFavorite };
}

export type SupabasePageModel = ReturnType<typeof useSupabasePage>;
