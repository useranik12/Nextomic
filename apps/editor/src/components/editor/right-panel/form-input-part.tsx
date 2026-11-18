"use client";

import {
  formPropTip,
  inputDesignKey,
  type ElementNode,
  type InputPart,
  type InputState
} from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import type { DesignProperty } from "./design-groups";
import { GroupBody } from "./group-body";
import { ChangeDots } from "./change-dots";
import { useStyleMarks } from "./use-style-marks";

/** The Design group id the panel remembers for every Form design setting. */
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
    .map((item) => {
      const tip = formPropTip(item);
      return {
        property: inputDesignKey(part.id, item.prop, state),
        as: item.prop,
        pinned: true,
        label: item.label,
        ...(item.options ? { options: item.options } : {}),
        ...(item.placeholder ? { placeholder: item.placeholder } : {}),
        ...(item.suggestions ? { suggestions: item.suggestions } : {}),
        ...(tip ? { tip } : {}),
        cluster: `${part.id}:${groupLabel}`
      };
    });
}

/**
 * The setting groups of one part in the chosen state. Each group is a folded section with a small
 * heading and a hairline between; groups that hold a value start open (the first one when none do).
 */
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
  const { index, breakpoint, state: editState } = useStyleMarks(node);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const groups = part.groups
    .map((group) => ({ group, properties: partProperties(part, state, group.label, query) }))
    .filter(({ properties }) => properties.length > 0);
  const markOf = (properties: DesignProperty[]) =>
    index.marks(
      properties.map((p) => p.property),
      breakpoint,
      editState
    );
  const anySet = groups.some(({ properties }) => markOf(properties).element === "here");
  return (
    <div className="flex flex-col">
      {groups.map(({ group, properties }, position) => {
        const marks = markOf(properties);
        const changed = marks.element === "here" ? 1 : 0;
        const key = `${part.id}:${state}:${group.label}`;
        const fallback = query ? true : anySet ? changed > 0 : position === 0;
        const open = toggled[key] ?? fallback;
        return (
          <section
            key={group.label}
            aria-label={group.label}
            className="border-t border-default first:border-t-0"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setToggled((current) => ({ ...current, [key]: !open }))}
              className="flex h-8 w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-muted outline-none transition-colors duration-300 hover:text-foreground focus-visible:ring-1 focus-visible:ring-focus/30"
            >
              {group.label}
              <ChangeDots marks={marks} decorative />
              <Icon
                name="ph:caret-down"
                width={12}
                height={12}
                className={"ml-auto transition-transform " + (open ? "rotate-180" : "")}
              />
            </button>
            {open ? (
              <div className="pb-4 pt-1">
                <GroupBody node={node} groupId={FORM_INPUT_GROUP} properties={properties} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
