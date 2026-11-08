"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  getQuerySourcesAction,
  type QuerySourcesSnapshot
} from "@/app/(builder)/editor/[id]/query-actions";

// The sources the Query Loop panel offers (saved Supabase structure, API Data calls), shared by
// every panel. They are fetched again whenever a panel opens, so a schema fetched or a call saved
// on another page shows up without reloading the editor.

interface QuerySourcesState {
  projectId: string | null;
  data: QuerySourcesSnapshot | null;
  error: string | null;
  loading: boolean;
  load: (projectId: string, force?: boolean) => Promise<void>;
}

export const useQuerySourcesStore = create<QuerySourcesState>((set, get) => ({
  projectId: null,
  data: null,
  error: null,
  loading: false,
  async load(projectId, force = false) {
    const state = get();
    if (state.loading || (!force && state.projectId === projectId && state.data)) return;
    set({ loading: true, error: null, projectId });
    try {
      const result = await getQuerySourcesAction(projectId);
      set({ data: result.data, error: result.error, loading: false });
    } catch {
      set({ error: "Could not load the query sources.", loading: false });
    }
  }
}));

/** The query sources of a project, fetched again when the caller mounts. */
export function useQuerySources(projectId: string) {
  const state = useQuerySourcesStore();
  const { load } = state;
  useEffect(() => {
    if (projectId) void load(projectId, true);
  }, [projectId, load]);
  return { ...state, reload: () => load(projectId, true) };
}
