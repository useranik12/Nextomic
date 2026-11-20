"use client";

import {
  FIELD_OPTION_WARN,
  OPTIONS_SOURCES,
  optionColumnProblem,
  queryLimit,
  type ElementNode,
  type OptionsSource
} from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useQuerySources } from "../query/use-query-sources";
import { useEditorStore } from "../store/editor-store";

const LABELS: Record<OptionsSource, string> = {
  static: "Static (fixed)",
  dynamic: "Dynamic Query"
};

/** Fixed options, written by hand, or options that come from a query (one option is the template). */
export function OptionsSourceControl({ node }: { node: ElementNode }) {
  const setSource = useEditorStore((s) => s.setOptionsSource);
  const projectId = useEditorStore((s) => s.projectId);
  const { data } = useQuerySources(projectId);
  const source: OptionsSource = node.props.optionsSource === "dynamic" ? "dynamic" : "static";
  const query = node.query;
  const typeProblem =
    source === "dynamic"
      ? optionColumnProblem(node, data?.supabase?.active ? data.supabase.structure : null)
      : null;
  const big = source === "dynamic" && query?.enabled && queryLimit(query) > FIELD_OPTION_WARN;
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        compact
        label="Options"
        value={source}
        options={OPTIONS_SOURCES.map((value) => ({ value, label: LABELS[value] }))}
        onValueChange={(next) => setSource(node.id, next as OptionsSource)}
      />
      {source === "dynamic" ? (
        <p role="note" className="flex items-start gap-1.5 text-xs text-muted">
          <Icon name="ph:info" width={14} height={14} className="mt-0.5 shrink-0" />
          The options come from the query set in Query Loop below. One option stays in the Navigator
          as the template and repeats once per row. Fill its label, subtext and value with the loop
          row tags (%name.item). The value must fit the value data type.
        </p>
      ) : null}
      {typeProblem ? (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
          <Icon name="ph:warning" width={14} height={14} className="mt-0.5 shrink-0" />
          {typeProblem}
        </p>
      ) : null}
      {big ? (
        <p role="status" className="flex items-start gap-1.5 text-xs text-warning">
          <Icon name="ph:warning" width={14} height={14} className="mt-0.5 shrink-0" />
          {node.type === "select"
            ? "The search box only filters the rows the query loads (its Limit), not the whole table."
            : `More than ${FIELD_OPTION_WARN} options are hard to scan. A searchable Select suits long lists.`}
        </p>
      ) : null}
    </div>
  );
}
