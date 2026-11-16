"use client";

import {
  INPUT_STATES,
  INPUT_STATE_LABELS,
  inputDesignKey,
  type ElementNode,
  type InputPart,
  type InputState
} from "@nextomic/schema";
import type { DesignProperty } from "./design-groups";
import { GroupBody } from "./group-body";

/** The Design group id the panel remembers for every Form Input setting. */
export const FORM_INPUT_GROUP = "forminput";

/** The settings of one group of a part in a state, as Design fields that store under the part key. */
export function partProperties(
  part: InputPart,
  state: InputState,
  groupLabel: string,
  query: string
): DesignProperty[] {
  const group = part.groups.find((g) => g.label === groupLabel);
  return (group?.props ?? [])
    .filter((item) => !query || item.label.toLowerCase().includes(query))
    .map((item) => ({
      property: inputDesignKey(part.id, item.prop, state),
      as: item.prop,
      pinned: true,
      label: item.label,
      ...(item.options ? { options: item.options } : {}),
      ...(item.placeholder ? { placeholder: item.placeholder } : {}),
      ...(item.suggestions ? { suggestions: item.suggestions } : {}),
      ...(item.tip ? { tip: item.tip } : {}),
      cluster: `${part.id}:${groupLabel}`
    }));
}

/** The state row of a part: the settings below apply to the chosen state only. */
export function StateRow({
  part,
  state,
  onChange
}: {
  part: InputPart;
  state: InputState;
  onChange: (state: InputState) => void;
}) {
  if (part.states.length < 2) return null;
  return (
    <div role="tablist" aria-label={`${part.label} state`} className="flex flex-wrap gap-1">
      {INPUT_STATES.filter((s) => part.states.includes(s)).map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={state === s}
          onClick={() => onChange(s)}
          className={
            "h-7 rounded-full px-2.5 text-xs font-medium transition-colors " +
            (state === s
              ? "bg-default-300 text-foreground"
              : "bg-default text-muted hover:bg-default-hover")
          }
        >
          {INPUT_STATE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

/** The settings of one part in the chosen state, grouped under small headings. */
export function PartBody({
  node,
  part,
  state,
  query
}: {
  node: ElementNode;
  part: InputPart;
  state: InputState;
  query: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {part.groups.map((group) => {
        const properties = partProperties(part, state, group.label, query);
        if (properties.length === 0) return null;
        return (
          <section key={group.label} aria-label={group.label}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {group.label}
            </h4>
            <GroupBody node={node} groupId={FORM_INPUT_GROUP} properties={properties} />
          </section>
        );
      })}
    </div>
  );
}
