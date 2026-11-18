"use client";

import {
  designGroupTitle,
  designPartsFor,
  parseFormDesignKey,
  type ElementNode,
  type InputPart,
  type InputState
} from "@nextomic/schema";
import { useEffect, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { PartBody, StateRow } from "./form-input-part";
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
 * Design > Form Input (and Form Checkbox, Form Options): every part of a form field is a sub-group
 * (field, label, box, text, icon, buttons, messages, options ...) with its own settings and states.
 * The open part and its state are also pinned on the canvas, so an Error, Focus or Checked style
 * can be seen while it is edited.
 */
export function FormInputGroup({ node, query }: { node: ElementNode; query: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, InputState>>({});
  const setPreview = useEditorStore((s) => s.setInputPreview);
  const target = useDesignTarget(node, "default");
  const setKeys = Object.keys(target.ownDeclarations ?? {});
  const title = designGroupTitle(node.type);
  const partList = designPartsFor(node.type);

  const shown = !query && open ? (states[open] ?? "default") : "default";
  useEffect(() => {
    setPreview(shown);
    return () => setPreview("default");
  }, [shown, setPreview, node.id]);

  const all = !query || title.toLowerCase().includes(query);
  const parts = partList.filter((part) => all || partMatches(part, query));
  // Under a search that matches a part's name, its settings all show.
  const settingQuery = (part: InputPart) =>
    all || part.label.toLowerCase().includes(query) ? "" : query;

  return (
    <div className="flex flex-col gap-1" aria-label={`${title} parts`}>
      {parts.map((part) => {
        const isOpen = query ? true : open === part.id;
        const state = states[part.id] ?? "default";
        const changed = setKeys.some((key) => parseFormDesignKey(key)?.part.id === part.id);
        return (
          <section key={part.id} data-input-part={part.id} aria-label={part.label}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : part.id)}
              className="flex h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-sm text-foreground outline-none transition-colors hover:bg-default focus-visible:ring-1 focus-visible:ring-focus/30"
            >
              {part.label}
              {changed ? (
                <span
                  role="img"
                  aria-label="Has changes"
                  className="h-1.5 w-1.5 rounded-full bg-warning"
                />
              ) : null}
              <Icon
                name="ph:caret-down"
                width={12}
                height={12}
                className={"ml-auto transition-transform " + (isOpen ? "rotate-180" : "")}
              />
            </button>
            {isOpen ? (
              <div className="mb-2 flex flex-col gap-4 rounded-2xl bg-default/40 p-3">
                <p className="text-xs text-muted">{part.about}</p>
                <StateRow
                  part={part}
                  state={state}
                  onChange={(next) => setStates((current) => ({ ...current, [part.id]: next }))}
                />
                <PartBody node={node} part={part} state={state} query={settingQuery(part)} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
