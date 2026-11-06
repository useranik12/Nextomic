"use client";

import {
  VARIABLE_NAME_PATTERN,
  VARIABLE_PREFIX,
  VARIABLE_TYPE_LABEL,
  variableSchema,
  type ProjectVariable
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { renameVariableAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { useVariableUsage } from "./use-variable-usage";
import { VariableFields } from "./variable-editor";

const BLANK: ProjectVariable = { name: "", type: "color", group: "Colors", value: "#0066ff" };

function Preview({ variable }: { variable: ProjectVariable }) {
  if (variable.type === "color")
    return (
      <span
        aria-hidden
        style={{ background: variable.value }}
        className="h-6 w-6 shrink-0 rounded-medium border border-divider"
      />
    );
  const sized = variable.type === "size" || variable.type === "fluid-size";
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-medium bg-default-100 text-default-600"
      style={{
        fontSize: sized ? `min(${variable.value}, 18px)` : undefined,
        fontFamily: variable.type === "font-family" ? variable.value : undefined,
        fontWeight: variable.type === "font-weight" ? variable.value : undefined,
        borderRadius: variable.type === "radius" ? variable.value : undefined,
        boxShadow: variable.type === "shadow" ? variable.value : undefined
      }}
    >
      {variable.type === "radius" || variable.type === "shadow" ? "" : "A"}
    </span>
  );
}

/** Variables grouped like the Bricks manager: search, create, edit, rename with references, delete. */
export function VariablesTab({ saveNow }: { saveNow: () => Promise<void> }) {
  const variables = useEditorStore((s) => s.project.variables);
  const pageId = useEditorStore((s) => s.page?.id);
  const { usage, reload } = useVariableUsage();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<ProjectVariable | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => [...new Set(variables.map((v) => v.group))].sort(), [variables]);
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, ProjectVariable[]>();
    for (const v of variables) {
      if (q && !`${v.name} ${v.value} ${v.group}`.toLowerCase().includes(q)) continue;
      map.set(v.group, [...(map.get(v.group) ?? []), v]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [variables, query]);

  function add() {
    if (!adding) return;
    const parsed = variableSchema.safeParse({ ...adding, name: adding.name.trim() });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid variable.");
    if (variables.some((v) => v.name === parsed.data.name)) return setError("That name is taken.");
    useEditorStore.getState().upsertVariables([parsed.data]);
    setAdding(null);
    setError(null);
  }

  function edit(next: ProjectVariable) {
    const parsed = variableSchema.safeParse(next);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid value.");
    setError(null);
    useEditorStore.getState().upsertVariables([parsed.data]);
  }

  async function rename() {
    if (!renaming || !pageId) return;
    const to = renaming.text.trim();
    if (!VARIABLE_NAME_PATTERN.test(to) || to.length > 48)
      return setError("Use lowercase letters, digits and -, starting with a letter.");
    if (to === renaming.from) return setRenaming(null);
    if (variables.some((v) => v.name === to)) return setError("That name is taken.");
    setBusy(true);
    const result = await renameVariableAction(
      useEditorStore.getState().projectId,
      pageId,
      renaming.from,
      to
    );
    if (result.error !== null) {
      setBusy(false);
      return setError(result.error);
    }
    useEditorStore.getState().renameVariable(renaming.from, to);
    await saveNow();
    await reload();
    setBusy(false);
    setRenaming(null);
    setError(null);
  }

  function remove(name: string) {
    const used = usage[name] ?? 0;
    const message = `${VARIABLE_PREFIX}${name} is used ${used} time${used === 1 ? "" : "s"}. Delete it anyway?`;
    if (used > 0 && !window.confirm(message)) return;
    useEditorStore.getState().deleteVariable(name);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-divider p-3">
        <div className="min-w-0 flex-1">
          <FormInput
            compact
            type="search"
            aria-label="Search variables"
            placeholder="Search variables"
            value={query}
            onValueChange={setQuery}
          />
        </div>
        <ActionButton size="sm" onPress={() => setAdding(adding ? null : { ...BLANK })}>
          {adding ? "Cancel" : "New variable"}
        </ActionButton>
      </div>
      {error ? (
        <p role="alert" className="px-4 pt-2 text-tiny text-danger">
          {error}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {adding ? (
          <div className="mb-4 flex flex-col gap-3 rounded-large border border-divider p-3">
            <FormInput
              compact
              label={`Name (written as ${VARIABLE_PREFIX}name)`}
              placeholder="brand-primary"
              value={adding.name}
              onValueChange={(name) => setAdding({ ...adding, name })}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            />
            <VariableFields variable={adding} onChange={setAdding} groups={groups} />
            <div className="flex justify-end">
              <ActionButton size="sm" onPress={add}>
                Add variable
              </ActionButton>
            </div>
          </div>
        ) : null}
        {variables.length === 0 && !adding ? (
          <p className="p-2 text-small text-default-500">
            No variables yet. Create one, or generate a type scale, spacing scale or color palette
            from the tabs on the left.
          </p>
        ) : null}
        {grouped.map(([group, list]) => (
          <section key={group} aria-label={group} className="mb-4">
            <h3 className="px-1 pb-1 text-tiny font-semibold uppercase text-default-500">
              {group} <span className="font-normal">({list.length})</span>
            </h3>
            <ul>
              {list.map((v) => (
                <li key={v.name} className="rounded-medium hover:bg-default-100/60">
                  <div className="flex h-10 items-center gap-2 px-2">
                    <Preview variable={v} />
                    {renaming?.from === v.name ? (
                      <input
                        autoFocus
                        aria-label={`Rename ${v.name}`}
                        value={renaming.text}
                        disabled={busy}
                        onChange={(e) => setRenaming({ from: v.name, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void rename();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        onBlur={() => setRenaming(null)}
                        className="h-7 min-w-0 flex-1 rounded-medium bg-default-100 px-2 font-mono text-small outline-none focus-visible:ring-2 focus-visible:ring-default-800/30"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpen(open === v.name ? null : v.name)}
                        aria-expanded={open === v.name}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="truncate font-mono text-small text-foreground">
                          {VARIABLE_PREFIX}
                          {v.name}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-tiny text-default-500">
                          {v.value}
                        </span>
                      </button>
                    )}
                    <span className="w-24 shrink-0 text-tiny text-default-500">
                      {VARIABLE_TYPE_LABEL[v.type]}
                    </span>
                    <span
                      className="w-8 shrink-0 text-right text-tiny text-default-500"
                      title={`${usage[v.name] ?? 0} reference${(usage[v.name] ?? 0) === 1 ? "" : "s"}`}
                    >
                      {usage[v.name] ?? 0}
                    </span>
                    <span className="flex w-14 shrink-0 items-center justify-end">
                      <button
                        type="button"
                        aria-label={`Rename ${v.name}`}
                        onClick={() => setRenaming({ from: v.name, text: v.name })}
                        className="rounded p-1 text-default-500 hover:text-foreground"
                      >
                        <Icon name="ph:pencil-simple" width={14} height={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${v.name}`}
                        onClick={() => remove(v.name)}
                        className="rounded p-1 text-default-500 hover:text-danger"
                      >
                        <Icon name="ph:trash" width={14} height={14} />
                      </button>
                    </span>
                  </div>
                  {open === v.name ? (
                    <div className="px-3 pb-3">
                      <VariableFields variable={v} onChange={edit} groups={groups} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
