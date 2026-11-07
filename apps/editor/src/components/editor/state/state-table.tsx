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
import { useEditorStore } from "../store/editor-store";
import { ROW_GRID, StateRow, type StateRowVariable } from "./state-row";
import { describePlaces, type StateUsage } from "./use-state-usage";

const HEADERS: Record<StateGroup, string[]> = {
  app: ["Name", "Type", "Is List", "Default Value", "Persist"],
  const: ["Name", "Type", "Is List", "Value", "Description"]
};

type Variable = AppStateVariable | Constant;

/** The App State or Constants table: rows, search, Add Variable. Edits save with the project. */
export function StateTable({ group, usage }: { group: StateGroup; usage: StateUsage }) {
  const projectId = useEditorStore((s) => s.projectId);
  const openId = useEditorStore((s) => s.page?.id ?? "");
  const list: Variable[] = useEditorStore((s) =>
    group === "app" ? s.project.appState : s.project.constants
  );
  const patchProject = useEditorStore((s) => s.patchProject);
  const renameInDoc = useEditorStore((s) => s.renameStateTagInDoc);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((v) => `${v.name} ${v.description}`.toLowerCase().includes(q)) : list;
  }, [list, query]);

  function commit(next: Variable[]) {
    const parsed = (group === "app" ? appStateListSchema : constantListSchema).safeParse(next);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid variable.");
    setError(null);
    patchProject(
      group === "app"
        ? { appState: parsed.data as AppStateVariable[] }
        : { constants: parsed.data as Constant[] }
    );
  }
  const replace = (id: string, next: Variable) => commit(list.map((v) => (v.id === id ? next : v)));

  async function rename(v: Variable, to: string) {
    const places = usage.placesOf(group, v.name);
    if (places.length > 0) {
      const ok = window.confirm(
        `"${v.name}" is used in: ${describePlaces(places)}. Rename it and update those bindings to "${to}"?`
      );
      if (!ok) return;
    }
    replace(v.id, { ...v, name: to });
    if (places.length === 0) return;
    renameInDoc(group, v.name, to);
    const result = await renameStateTagAction(projectId, openId || "-", group, v.name, to);
    if (result.error) setError(result.error);
    usage.reload();
  }

  function remove(v: Variable) {
    const places = usage.placesOf(group, v.name);
    const message =
      places.length > 0
        ? `"${v.name}" is used in: ${describePlaces(places)}. Those bindings will show nothing. Delete it?`
        : `Delete "${v.name}"?`;
    if (window.confirm(message)) commit(list.filter((x) => x.id !== v.id));
  }

  function add() {
    const taken = list.map((v) => v.name);
    const id = crypto.randomUUID();
    commit([...list, group === "app" ? newAppStateVariable(id, taken) : newConstant(id, taken)]);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-3">
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
      {error ? (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <div className="min-w-[46rem]">
          <div
            className={`grid ${ROW_GRID[group]} gap-2 border-b border-divider pb-2 text-small font-medium text-default-600`}
          >
            {HEADERS[group].map((h) => (
              <span key={h} className={h === "Persist" ? "" : "px-1"}>
                {h}
              </span>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="py-6 text-small text-default-500">
              {group === "app"
                ? "No app state yet. App state holds values any page can read and actions can change, such as a cart count or a chosen language."
                : "No constants yet. Constants hold fixed values any page can read, such as a support email or a tax rate."}
            </p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-small text-default-500">No variable matches “{query}”.</p>
          ) : (
            <ul>
              {shown.map((v) => (
                <StateRow
                  key={v.id}
                  row={{ kind: group, variable: v } as StateRowVariable}
                  taken={list.filter((x) => x.id !== v.id).map((x) => x.name)}
                  places={usage.placesOf(group, v.name)}
                  onChange={(next) => replace(v.id, next)}
                  onRename={(to) => void rename(v, to)}
                  onDelete={() => remove(v)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <div>
        <ActionButton size="sm" tone="ghost" className="border border-default-300" onPress={add}>
          <Icon name="ph:plus" width={14} height={14} />
          Add Variable
        </ActionButton>
      </div>
    </div>
  );
}
