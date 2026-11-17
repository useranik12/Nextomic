"use client";

import { OPTIONS_SOURCES, type ElementNode, type OptionsSource } from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";

const LABELS: Record<OptionsSource, string> = {
  static: "Static (fixed)",
  dynamic: "Dynamic Query"
};

/** Fixed options, written by hand, or options that come from a query (one option is the template). */
export function OptionsSourceControl({ node }: { node: ElementNode }) {
  const setSource = useEditorStore((s) => s.setOptionsSource);
  const source: OptionsSource = node.props.optionsSource === "dynamic" ? "dynamic" : "static";
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
    </div>
  );
}
