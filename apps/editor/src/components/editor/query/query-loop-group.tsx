"use client";

import {
  newElementQuery,
  QUERY_SOURCE_LABELS,
  queryProblems,
  type ElementNode,
  type ElementQuery,
  type QuerySource
} from "@nextomic/schema";
import { ActionButton, SelectField, type SelectOption } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { useLoopPreview } from "../canvas/use-canvas-loop-rows";
import { useEditorStore } from "../store/editor-store";
import { RestQueryForm } from "./rest-query-form";
import { SupabaseQueryForm } from "./supabase-query-form";
import { useQuerySources } from "./use-query-sources";
import type { QuerySourcesSnapshot } from "@/app/(builder)/editor/[id]/query-actions";

// The Query Loop group of a Container or Section (docs/dynamic-data-and-actions.md section 3):
// the Enable Backend Query toggle, the query type, and the settings of that type. Turning the
// toggle off keeps the settings, so turning it on again restores them.

function sourceOptions(data: QuerySourcesSnapshot | null): SelectOption[] {
  const supabase = data?.supabase;
  const tables = supabase?.structure?.schemas.some((s) => s.tables.length > 0) ?? false;
  const supabaseHint = !supabase
    ? "Connect Supabase first."
    : !supabase.active
      ? "Supabase is turned off for this project."
      : !tables
        ? "Fetch the Supabase schema first."
        : undefined;
  const restHint =
    (data?.rest.calls.length ?? 0) === 0 ? "Add an API call in API Data first." : undefined;
  return [
    {
      value: "supabase",
      label: QUERY_SOURCE_LABELS.supabase,
      disabled: !!supabaseHint,
      hint: supabaseHint
    },
    { value: "rest", label: QUERY_SOURCE_LABELS.rest, disabled: !!restHint, hint: restHint }
  ];
}

export function QueryLoopGroup({ node }: { node: ElementNode }) {
  const projectId = useEditorStore((s) => s.projectId);
  const setQuery = useEditorStore((s) => s.setElementQuery);
  const { data, error, loading, reload } = useQuerySources(projectId);
  const previewError = useLoopPreview((s) => s.errors[node.id]);
  const query = node.query;
  const enabled = query?.enabled ?? false;

  const update = (next: ElementQuery) => setQuery(node.id, next);
  const toggle = (on: boolean) => {
    if (on) update(query ? { ...query, enabled: true } : newElementQuery());
    else if (query) update({ ...query, enabled: false });
  };

  const problems =
    query && data
      ? queryProblems(query, {
          supabase: data.supabase?.active ? data.supabase.structure : null,
          rest: data.rest
        })
      : [];

  return (
    <div className="flex flex-col gap-5">
      <SwitchRow
        label="Enable Backend Query"
        tip="Run a Supabase or REST query and repeat this element's children once per row. The children bind the row as item and its position as index."
        selected={enabled}
        onChange={toggle}
      />
      {error ? (
        <div role="alert" className="flex items-center gap-2 text-small text-danger">
          {error}
          <ActionButton size="sm" tone="ghost" onPress={() => void reload()}>
            Retry
          </ActionButton>
        </div>
      ) : null}
      {loading && !data ? (
        <p className="text-small text-default-500" aria-live="polite">
          Loading data sources...
        </p>
      ) : null}
      {query && data ? (
        <div
          inert={!enabled}
          aria-disabled={!enabled}
          className={"flex flex-col gap-5 transition-opacity " + (enabled ? "" : "opacity-50")}
        >
          <SelectField
            compact
            label="Query Type"
            options={sourceOptions(data)}
            value={query.source}
            onValueChange={(source) => update({ ...query, source: source as QuerySource })}
          />
          {query.source === "supabase" ? (
            <SupabaseQueryForm
              value={query.supabase}
              structure={data.supabase?.structure ?? null}
              onChange={(supabase) => update({ ...query, supabase })}
            />
          ) : (
            <RestQueryForm
              value={query.rest}
              config={data.rest}
              onChange={(rest) => update({ ...query, rest })}
            />
          )}
          {enabled && problems.length === 0 && previewError ? (
            <p role="status" className="text-tiny text-danger">
              Canvas preview: {previewError}
            </p>
          ) : null}
          {enabled && problems.length > 0 ? (
            <ul role="status" className="flex flex-col gap-1 text-tiny text-warning">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
