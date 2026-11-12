"use client";

import { SelectionBar } from "../manager/selection-bar";
import { useDesignNav } from "../design-nav";
import { Icon } from "@/lib/icons/Icon";
import {
  VARIABLE_PREFIX,
  VARIABLE_TYPES,
  VARIABLE_TYPE_LABEL,
  variableSchema,
  type ProjectVariable
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { useEditorStore } from "../../store/editor-store";
import { useFramework } from "../framework/use-framework";
import { CategoryPanel, type CategoryItem } from "../manager/category-panel";
import { ManagerToolbar } from "../manager/manager-toolbar";
import { useVariableUsage } from "../use-variable-usage";
import { FrameworkVariableRow, ProjectVariableRow } from "./variable-row";
import {
  buildCategories,
  buildRows,
  filterRows,
  guessVariableType,
  type VarFilter,
  type VarSort
} from "./variable-model";

const SORTS = [
  { value: "name", label: "Name A to Z" },
  { value: "name-desc", label: "Name Z to A" },
  { value: "value", label: "Value" },
  { value: "type", label: "Type" },
  { value: "used", label: "Most used" }
];
const FILTERS = [
  { value: "all", label: "All variables" },
  { value: "unused", label: "Unused" },
  ...VARIABLE_TYPES.map((t) => ({ value: t, label: VARIABLE_TYPE_LABEL[t] }))
];

/**
 * Variable manager (Bricks style): categories on the left, the variables in the middle, a row to
 * add one at the bottom. The project's variables are editable; the theme framework's variables show
 * with COLORS and SCALE badges and are edited in their own tabs.
 */
const toggled = (set: Set<string>, name: string, on: boolean): Set<string> => {
  const next = new Set(set);
  if (on) next.add(name);
  else next.delete(name);
  return next;
};

export function VariablesTab() {
  const variables = useEditorStore((s) => s.project.variables);
  const variableCategories = useEditorStore((s) => s.project.variableCategories);
  const { framework, setFramework } = useFramework();
  const { usage } = useVariableUsage();
  const nav = useDesignNav();
  const [include, setInclude] = useState(nav.params.variable ?? "");
  const [exclude, setExclude] = useState("");
  const [sort, setSort] = useState<VarSort>("name");
  const [filter, setFilter] = useState<VarFilter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(nav.params.variable ?? null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const rows = useMemo(() => buildRows(variables, framework), [variables, framework]);
  const categories = useMemo(
    () => buildCategories(rows, variableCategories),
    [rows, variableCategories]
  );
  const shown = useMemo(
    () => filterRows(rows, { include, exclude, sort, filter, category }, usage),
    [rows, include, exclude, sort, filter, category, usage]
  );
  const projectNames = useMemo(
    () => [...new Set([...variables.map((v) => v.group), ...variableCategories, "General"])].sort(),
    [variables, variableCategories]
  );
  const items: CategoryItem[] = categories.map((c) => ({
    id: `${c.source}:${c.name}`,
    name: c.name,
    count: c.count,
    editable: c.source === "project" && c.name !== "General",
    ...(c.badge ? { badge: c.badge } : {})
  }));
  const selectedProjectCategory = category?.startsWith("project:") ? category.slice(8) : "General";

  /** Project variables in view can be selected; framework variables belong to their own tabs. */
  const selectable = useMemo(
    () => shown.filter((r) => r.source === "project").map((r) => r.name),
    [shown]
  );

  function deletePicked() {
    const names = [...picked].filter((n) => variables.some((v) => v.name === n));
    const used = names.reduce((sum, n) => sum + (usage[n] ?? 0), 0);
    const message =
      used > 0
        ? `Delete ${names.length} variable${names.length === 1 ? "" : "s"}? They are used ${used} time${used === 1 ? "" : "s"}.`
        : `Delete ${names.length} variable${names.length === 1 ? "" : "s"}?`;
    if (names.length === 0 || !window.confirm(message)) return;
    for (const n of names) useEditorStore.getState().deleteVariable(n);
    setPicked(new Set());
    setOpen(null);
  }

  function patchCategories(list: string[]) {
    useEditorStore.getState().patchProject({ variableCategories: list });
  }

  function addCategory(next: string): string | null {
    if (next === "" || next.length > 48) return "Give the category a name (up to 48 characters).";
    if (projectNames.some((n) => n.toLowerCase() === next.toLowerCase()))
      return "That category exists.";
    patchCategories([...variableCategories, next]);
    setCategory(`project:${next}`);
    return null;
  }

  function renameCategory(id: string, to: string): string | null {
    const from = id.slice(8);
    if (to === from) return null;
    if (to === "" || to.length > 48) return "Give the category a name (up to 48 characters).";
    if (projectNames.some((n) => n.toLowerCase() === to.toLowerCase()))
      return "That category exists.";
    const store = useEditorStore.getState();
    store.upsertVariables(
      variables.filter((v) => v.group === from).map((v) => ({ ...v, group: to }))
    );
    patchCategories(variableCategories.map((c) => (c === from ? to : c)));
    setCategory(`project:${to}`);
    return null;
  }

  function deleteCategory(id: string) {
    const from = id.slice(8);
    const count = variables.filter((v) => v.group === from).length;
    if (count > 0 && !window.confirm(`Move the ${count} variables of "${from}" to General?`))
      return;
    useEditorStore
      .getState()
      .upsertVariables(
        variables.filter((v) => v.group === from).map((v) => ({ ...v, group: "General" }))
      );
    patchCategories(variableCategories.filter((c) => c !== from));
    setCategory(null);
  }

  function add() {
    const parsed = variableSchema.safeParse({
      name: name.trim(),
      value: value.trim(),
      type: guessVariableType(value),
      group: selectedProjectCategory
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid variable.");
    if (variables.some((v) => v.name === parsed.data.name)) return setError("That name is taken.");
    useEditorStore.getState().upsertVariables([parsed.data]);
    setName("");
    setValue("");
    setError(null);
  }

  function editFramework(varName: string, next: string) {
    if (!framework) return;
    const failed = setFramework({
      ...framework,
      variables: framework.variables.map((v) =>
        v.name === varName && next.trim() !== "" ? { ...v, value: next.trim() } : v
      )
    });
    setError(failed);
  }

  const byName = new Map<string, ProjectVariable>(variables.map((v) => [v.name, v]));
  return (
    <div className="flex h-full min-h-0">
      <CategoryPanel
        title="Categories"
        total={rows.length}
        items={items}
        selected={category}
        onSelect={setCategory}
        onAdd={addCategory}
        onRename={renameCategory}
        onDelete={deleteCategory}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ManagerToolbar
          include={include}
          exclude={exclude}
          onInclude={setInclude}
          onExclude={setExclude}
          sort={sort}
          sortOptions={SORTS}
          onSort={(v) => setSort(v as VarSort)}
          filter={filter}
          filterOptions={FILTERS}
          onFilter={(v) => setFilter(v as VarFilter)}
        />
        <div className="flex flex-col gap-1 px-4 pt-3">
          <h3 className="text-sm font-semibold">Variables ({shown.length})</h3>
          <SelectionBar
            noun="variables"
            total={selectable.length}
            selected={picked.size}
            onSelectAll={() => setPicked(new Set(selectable))}
            onClear={() => setPicked(new Set())}
            onDelete={deletePicked}
          />
        </div>
        {error ? (
          <p role="alert" className="px-4 pt-1 text-xs text-danger">
            {error}
          </p>
        ) : null}
        <ul
          aria-label="Variables"
          className="mt-2 min-h-0 flex-1 overflow-y-auto border-y border-border"
        >
          {shown.length === 0 ? (
            <li className="p-4 text-sm text-muted">
              {rows.length === 0 ? "No variables yet. Add one below." : "No variable matches."}
            </li>
          ) : (
            shown.map((r) => {
              const v = byName.get(r.name);
              return r.source === "project" && v ? (
                <ProjectVariableRow
                  key={r.key}
                  row={r}
                  variable={v}
                  used={usage[r.name] ?? 0}
                  categories={projectNames}
                  checked={picked.has(r.name)}
                  onCheck={(on) => setPicked(toggled(picked, r.name, on))}
                  open={open === r.key}
                  onToggle={() => setOpen(open === r.key ? null : r.key)}
                  onError={setError}
                />
              ) : (
                <FrameworkVariableRow key={r.key} row={r} onEdit={editFramework} />
              );
            })
          )}
        </ul>
        <form
          className="flex items-center gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <span aria-hidden className="shrink-0 font-mono text-xs text-muted">
            {VARIABLE_PREFIX}
          </span>
          <input
            aria-label="New variable name"
            placeholder="New variable name"
            value={name}
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 font-mono text-sm outline-none focus:border-focus"
          />
          <span aria-hidden className="text-subtle">
            =
          </span>
          <input
            aria-label="New variable value"
            placeholder="Value"
            value={value}
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 font-mono text-sm outline-none focus:border-focus"
          />
          <ActionButton
            size="sm"
            type="submit"
            isDisabled={name.trim() === "" || value.trim() === ""}
          >
            <Icon name="ph:plus" width={14} height={14} />
            Add to {selectedProjectCategory}
          </ActionButton>
        </form>
      </div>
    </div>
  );
}
