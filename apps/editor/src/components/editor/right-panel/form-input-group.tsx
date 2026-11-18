"use client";

import {
  designGroupTitle,
  designPartsFor,
  editStateLabel,
  parseFormDesignKey,
  partStateOf,
  type ElementNode,
  type InputPart
} from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { PartBody } from "./form-input-part";
import { useDesignTarget } from "./use-design-target";

const partMatches = (part: InputPart, query: string): boolean =>
  part.label.toLowerCase().includes(query) ||
  part.groups.some((g) => g.props.some((item) => item.label.toLowerCase().includes(query)));

/** Whether anything of the element's parts matches a settings search (so the group stays in the list). */
export function formInputMatches(type: string, query: string): boolean {
  const parts = designPartsFor(type);
  if (parts.length === 0) return false;
  return (
    !query ||
    designGroupTitle(type).toLowerCase().includes(query) ||
    parts.some((p) => partMatches(p, query))
  );
}

/**
 * Design > Form Input / Form Checkbox / Form Options: every part of a form field is a folded row
 * with its own settings. The state is the one chosen in the state select above (Default, Hover,
 * Focus, Checked, Error ...) and is pinned on the canvas; a part that has no such state stays in
 * the list, dimmed, and says so.
 */
export function FormInputGroup({ node, query }: { node: ElementNode; query: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const activeState = useEditorStore((s) => s.activeState);
  const target = useDesignTarget(node, "default");
  const setKeys = Object.keys(target.ownDeclarations ?? {});
  const title = designGroupTitle(node.type);
  const partState = partStateOf(activeState);
  const stateLabel = editStateLabel(node.type, activeState);

  const all = !query || title.toLowerCase().includes(query);
  const parts = designPartsFor(node.type).filter((part) => all || partMatches(part, query));
  // Under a search that matches a part's name, its settings all show.
  const settingQuery = (part: InputPart) =>
    all || part.label.toLowerCase().includes(query) ? "" : query;

  return (
    <div className="flex flex-col gap-1" aria-label={`${title} parts`}>
      <p className="px-2 pb-1 text-xs text-muted">
        Editing <span className="font-medium text-foreground">{stateLabel}</span>. Change the state
        in the select above.
      </p>
      {parts.map((part) => {
        const supported = partState !== null && part.states.includes(partState);
        const isOpen = supported && (query ? true : open === part.id);
        const changed = setKeys.some((key) => parseFormDesignKey(key)?.part.id === part.id);
        return (
          <section key={part.id} data-input-part={part.id} aria-label={part.label}>
            <button
              type="button"
              aria-expanded={isOpen}
              disabled={!supported}
              title={supported ? undefined : `${part.label} has no ${stateLabel} state`}
              onClick={() => setOpen(isOpen ? null : part.id)}
              className="flex h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-foreground outline-none transition-colors duration-300 hover:bg-default focus-visible:ring-1 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {part.label}
              {changed ? (
                <span
                  role="img"
                  aria-label="Has changes"
                  className="h-1.5 w-1.5 rounded-full bg-warning"
                />
              ) : null}
              {supported ? null : (
                <span className="text-xs text-muted">no {stateLabel.toLowerCase()}</span>
              )}
              <Icon
                name="ph:caret-down"
                width={12}
                height={12}
                className={"ml-auto transition-transform " + (isOpen ? "rotate-180" : "")}
              />
            </button>
            {isOpen && partState ? (
              <div className="mb-2 flex flex-col gap-3 rounded-2xl bg-default/40 p-3">
                <p className="text-xs text-muted">{part.about}</p>
                <PartBody node={node} part={part} state={partState} query={settingQuery(part)} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
