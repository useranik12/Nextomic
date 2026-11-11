"use client";

import {
  appStateListSchema,
  constantListSchema,
  newAppStateVariable,
  newConstant,
  type AppStateVariable,
  type Constant,
  type StateGroup
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { renameStateTagAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { DraftActions, DraftScope } from "../draft-scope";
import { useEditorStore } from "../store/editor-store";
import { ROW_GRID, StateRow, type StateRowVariable } from "./state-row";
import { describePlaces, type StateUsage } from "./use-state-usage";

const HEADERS: Record<StateGroup, string[]> = {
  app: ["Name", "Type", "Is List", "Default Value", "Persist"],
  const: ["Name", "Type", "Is List", "Value", "Description"]
};
const LABELS: Record<StateGroup, string> = { app: "App State", const: "Constants" };

type Variable = AppStateVariable | Constant;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The App State or Constants table: rows, search, Add Variable. Edits are a draft until Save;
 * renaming a used variable updates its tags everywhere when the draft is saved.
 */
export function StateTable({ group, usage }: { group: StateGroup; usage: StateUsage }) {
  const projectId = useEditorStore((s) => s.projectId);
  const openId = useEditorStore((s) => s.page?.id ?? "");
  const saved: Variable[] = useEditorStore((s) =>
    group === "app" ? s.project.appState : s.project.constants
  );
  const patchProject = useEditorStore((s) => s.patchProject);
  const renameInDoc = useEditorStore((s) => s.renameStateTagInDoc);
  const [draft, setDraft] = useState<Variable[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = draft ?? saved;
  const dirty = draft !== null && !sameJson(draft, saved);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((v) => `${v.name} ${v.description}`.toLowerCase().includes(q)) : list;
  }, [list, query]);

  /** Where the saved variable with this id is used (renames in the draft keep its old places). */
  const placesOf = (v: Variable) =>
    usage.placesOf(group, saved.find((s) => s.id === v.id)?.name ?? v.name);
  const replace = (id: string, next: Variable) =>
    setDraft(list.map((v) => (v.id === id ? next : v)));

  function remove(v: Variable) {
    const places = placesOf(v);
    const message =
      places.length > 0
        ? `"${v.name}" is used in: ${describePlaces(places)}. Those bindings will show nothing. Delete it?`
        : `Delete "${v.name}"?`;
    if (window.confirm(message)) setDraft(list.filter((x) => x.id !== v.id));
  }

  function add() {
    const taken = list.map((v) => v.name);
    const id = crypto.randomUUID();
    setDraft([...list, group === "app" ? newAppStateVariable(id, taken) : newConstant(id, taken)]);
    setQuery("");
  }

  async function save(): Promise<boolean> {
    if (!draft) return true;
    const parsed = (group === "app" ? appStateListSchema : constantListSchema).safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid variable.");
      return false;
    }
    const renames = draft.flatMap((v) => {
      const before = saved.find((s) => s.id === v.id);
      return before && before.name !== v.name
        ? [{ from: before.name, to: v.name, places: usage.placesOf(group, before.name) }]
        : [];
    });
    const used = renames.filter((r) => r.places.length > 0);
    if (used.length > 0) {
      const lines = used.map(
        (r) => `"${r.from}" → "${r.to}" (used in ${describePlaces(r.places)})`
      );
      if (!window.confirm(`Rename and update the bindings?\n${lines.join("\n")}`)) return false;
    }
    setError(null);
    patchProject(
      group === "app"
        ? { appState: parsed.data as AppStateVariable[] }
        : { constants: parsed.data as Constant[] }
    );
    setDraft(null);
    for (const r of used) {
      renameInDoc(group, r.from, r.to);
      const result = await renameStateTagAction(projectId, openId || "-", group, r.from, r.to);
      if (result.error) setError(result.error);
    }
    if (used.length > 0) usage.reload();
    return true;
  }

  const discard = () => {
    setDraft(null);
    setError(null);
  };

  return (
    <DraftScope label={LABELS[group]} dirty={dirty} onSave={save} onDiscard={discard}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-72 max-w-full">
              <Icon
                name="ph:magnifying-glass"
                width={14}
                height={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-default-500"
              />
              <input
                aria-label={group === "app" ? "Search app state" : "Search constants"}
                placeholder="Search variables"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-full rounded-full border border-default-200 bg-transparent pl-8 pr-3 text-small outline-none transition-colors hover:border-default-400 focus:border-default-800"
              />
            </div>
            {usage.loading ? (
              <span className="text-tiny text-default-500">Finding where used…</span>
            ) : null}
            {usage.error ? (
              <span role="alert" className="text-tiny text-danger">
                {usage.error}
              </span>
            ) : null}
          </div>
          <DraftActions
            label={LABELS[group]}
            dirty={dirty}
            onSave={() => void save()}
            onDiscard={discard}
          />
        </div>
        {error ? (
          <p role="alert" className="text-tiny text-danger">
            {error}
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-large border border-default-100 bg-content1/40">
          <div className="min-w-[54rem] px-3">
            <div
              className={`grid ${ROW_GRID[group]} gap-2 border-b border-divider py-2.5 text-tiny font-semibold uppercase tracking-wide text-default-500`}
            >
              {HEADERS[group].map((h) => (
                <span key={h} className={h === "Persist" ? "" : "px-1"}>
                  {h}
                </span>
              ))}
            </div>
            {list.length === 0 ? (
              <p className="py-8 text-small text-default-500">
                {group === "app"
                  ? "No app state yet. App state holds values any page can read and actions can change, such as a cart count or a chosen language."
                  : "No constants yet. Constants hold fixed values any page can read, such as a support email or a tax rate."}
              </p>
            ) : shown.length === 0 ? (
              <p className="py-8 text-small text-default-500">No variable matches “{query}”.</p>
            ) : (
              <ul>
                {shown.map((v) => (
                  <StateRow
                    key={v.id}
                    row={{ kind: group, variable: v } as StateRowVariable}
                    taken={list.filter((x) => x.id !== v.id).map((x) => x.name)}
                    places={placesOf(v)}
                    onChange={(next) => replace(v.id, next)}
                    onRename={(to) => replace(v.id, { ...v, name: to })}
                    onDelete={() => remove(v)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <ActionButton size="sm" tone="outline" onPress={add}>
            <Icon name="ph:plus" width={14} height={14} />
            Add Variable
          </ActionButton>
        </div>
      </div>
    </DraftScope>
  );
}
