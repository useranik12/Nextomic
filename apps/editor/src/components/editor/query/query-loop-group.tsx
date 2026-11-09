"use client";

import {
  freeLoopName,
  LOOP_NAME_BASES,
  loopNames,
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
import { LoopNameField } from "./loop-name-field";
import { RestQueryForm } from "./rest-query-form";
import { SupabaseQueryForm } from "./supabase-query-form";
import { useQuerySources } from "./use-query-sources";
import type { QuerySourcesSnapshot } from "@/app/(builder)/editor/[id]/query-actions";

// The Query Loop group of a Container or Section (docs/dynamic-data-and-actions.md section 3):
// the Enable Query Loop toggle, the loop name (read as %name inside the loop), the query type, and
// the settings of that type. Turning the toggle off keeps the settings, so turning it on again
// restores them.

/** True when a name is still a source's default (`supabaseLoop`, `restLoop2` ...). */
const isDefaultName = (name: string) =>
  Object.values(LOOP_NAME_BASES).some((base) => new RegExp(`^${base}\\d*$`).test(name));

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
  const renameLoop = useEditorStore((s) => s.renameLoop);
  const tree = useEditorStore((s) => s.doc?.tree);
  const { data, error, loading, reload } = useQuerySources(projectId);
  const previewError = useLoopPreview((s) => s.errors[node.id]);
  const query = node.query;
  const enabled = query?.enabled ?? false;

  const update = (next: ElementQuery) => setQuery(node.id, next);
  const toggle = (on: boolean) => {
    if (on)
      update(query ? { ...query, enabled: true } : newElementQuery(tree ? loopNames(tree) : []));
    else if (query) update({ ...query, enabled: false });
  };

  const changeSource = (source: QuerySource) => {
    if (!query) return;
    update({ ...query, source });
    // A default name follows the type, so a REST loop is not left named supabaseLoop.
    if (tree && isDefaultName(query.name))
      renameLoop(node.id, freeLoopName(LOOP_NAME_BASES[source], loopNames(tree, node.id)));
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
        label="Enable Query Loop"
        tip="Run a query and repeat this element's children once per row. Inside the loop, read the row as %name.item and its position as %name.index (name = the Loop name)."
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
          <LoopNameField node={node} />
          <SelectField
            compact
            label="Query Type"
            options={sourceOptions(data)}
            value={query.source}
            onValueChange={(source) => changeSource(source as QuerySource)}
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
