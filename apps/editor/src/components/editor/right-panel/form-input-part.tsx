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
import { useDesignTarget } from "./use-design-target";

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
  const target = useDesignTarget(node, "default");
  const set = new Set(Object.keys(target.ownDeclarations ?? {}));
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const groups = part.groups
    .map((group) => ({ group, properties: partProperties(part, state, group.label, query) }))
    .filter(({ properties }) => properties.length > 0);
  const anySet = groups.some(({ properties }) => properties.some((p) => set.has(p.property)));
  return (
    <div className="flex flex-col">
      {groups.map(({ group, properties }, index) => {
        const changed = properties.filter((p) => set.has(p.property)).length;
        const key = `${part.id}:${state}:${group.label}`;
        const fallback = query ? true : anySet ? changed > 0 : index === 0;
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
              {changed > 0 ? (
                <span
                  role="img"
                  aria-label={`${changed} changed`}
                  className="h-1.5 w-1.5 rounded-full bg-warning"
                />
              ) : null}
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
