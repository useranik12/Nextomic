"use client";

import {
  activeQuery,
  findNode,
  PARAM_TEXT_MAX,
  parseRefreshQuery,
  QUERY_SOURCE_LABELS,
  queryProblems,
  type ElementNode,
  type ElementQuery,
  type ParamField,
  type Params
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { LocalQueryForm } from "../../query/local-query-form";
import { QueryFormModeProvider } from "../../query/query-form-mode";
import { RestQueryForm } from "../../query/rest-query-form";
import { SupabaseQueryForm } from "../../query/supabase-query-form";
import { useQuerySources } from "../../query/use-query-sources";
import { useEditorStore } from "../../store/editor-store";
import { refreshTips } from "./refresh-tips";

// The query settings of a Refresh Query action (docs/dynamic-data-and-actions.md section 8.7):
// every setting of the chosen loop's query, prefilled with the loop's own values, for the owner to
// change. The edited query is saved on the action as JSON; the server runs it, filling only the
// tags with the values the browser sends. Each label's tip says what the loop itself uses.

/** The chosen loop's own query, as the action saves it; empty when there is no such loop. */
export function loopQueryText(tree: ElementNode | undefined, loopId: unknown): string {
  const node = tree && typeof loopId === "string" && loopId ? findNode(tree, loopId)?.node : null;
  const query = node ? activeQuery(node) : null;
  return query ? JSON.stringify(query) : "";
}

const note = "text-xs text-muted";

export function QueryOverrideInput({
  field,
  params,
  value,
  onChange
}: {
  field: ParamField;
  params: Params;
  value: string;
  onChange: (value: string) => void;
}) {
  const projectId = useEditorStore((s) => s.projectId);
  const tree = useEditorStore((s) => s.doc?.tree);
  const { data, error, loading, reload } = useQuerySources(projectId);
  const loopId = params[field.targetParam ?? ""];
  const node = tree && typeof loopId === "string" && loopId ? findNode(tree, loopId)?.node : null;
  const loop = node ? activeQuery(node) : null;
  const saved = parseRefreshQuery(value);
  const typeChanged = !!saved && !!loop && saved.source !== loop.source;
  const query = saved && !typeChanged ? saved : loop;
  const [tooLarge, setTooLarge] = useState(false);

  const body = () => {
    if (!loopId) return <p className={note}>Choose a query loop to edit its settings.</p>;
    if (!node || !loop || !query)
      return (
        <p role="alert" className="text-xs text-danger">
          This query loop is no longer on the page, or its query is turned off.
        </p>
      );
    if (error)
      return (
        <div role="alert" className="flex items-center gap-2 text-xs text-danger">
          {error}
          <ActionButton size="sm" tone="ghost" onPress={() => void reload()}>
            Retry
          </ActionButton>
        </div>
      );
    if (loading || !data)
      return (
        <p className={note} aria-live="polite">
          Loading data sources...
        </p>
      );
    const update = (next: ElementQuery) => {
      const text = JSON.stringify({ ...next, name: loop.name, enabled: true });
      setTooLarge(text.length > PARAM_TEXT_MAX);
      if (text.length <= PARAM_TEXT_MAX) onChange(text);
    };
    const problems = queryProblems(query, {
      supabase: data.supabase?.active ? data.supabase.structure : null,
      rest: data.rest
    });
    const tip = refreshTips(loop, data.rest);
    return (
      <QueryFormModeProvider value={{ serverRun: false, refresh: true, tip }}>
        <SelectField
          compact
          isDisabled
          label="Query Type"
          tip={tip("type")}
          options={[{ value: loop.source, label: QUERY_SOURCE_LABELS[loop.source] }]}
          value={loop.source}
          onValueChange={() => undefined}
        />
        {query.source === "supabase" ? (
          <SupabaseQueryForm
            value={query.supabase}
            structure={data.supabase?.structure ?? null}
            onChange={(supabase) => update({ ...query, supabase })}
          />
        ) : query.source === "rest" ? (
          <RestQueryForm
            value={query.rest}
            config={data.rest}
            onChange={(rest) => update({ ...query, rest })}
          />
        ) : (
          <LocalQueryForm
            node={node}
            value={query.local}
            onChange={(local) => update({ ...query, local })}
          />
        )}
        {typeChanged ? (
          <p role="status" className="text-xs text-warning">
            The loop&apos;s query type changed after these settings were saved: they show the
            loop&apos;s own settings now.
          </p>
        ) : null}
        {tooLarge ? (
          <p role="alert" className="text-xs text-danger">
            These settings are too large to save. Remove some filters or variables.
          </p>
        ) : null}
        {problems.length > 0 ? (
          <ul role="status" className="flex flex-col gap-1 text-xs text-warning">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
        <ActionButton
          size="sm"
          tone="ghost"
          className="self-start"
          isDisabled={!saved || value === JSON.stringify(loop)}
          onPress={() => onChange(JSON.stringify(loop))}
        >
          Reset to the loop&apos;s settings
        </ActionButton>
      </QueryFormModeProvider>
    );
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-body">{field.label}</legend>
      {body()}
    </fieldset>
  );
}
