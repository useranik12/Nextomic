"use client";

import { Icon } from "@/lib/icons/Icon";
import {
  countClassUsage,
  frameworkClassRules,
  frameworkClasses,
  frameworkStylesheet
} from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { classUsageAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton } from "@/components/ui/controls";
import { useEditorStore } from "../../store/editor-store";
import { useDesignNav } from "../design-nav";
import { useFramework } from "../framework/use-framework";
import { CategoryPanel } from "../manager/category-panel";
import { SelectionBar } from "../manager/selection-bar";
import { ManagerToolbar } from "../manager/manager-toolbar";
import { ClassDeleteDialog } from "./class-delete-dialog";
import { ClassEditPanel, validClassName } from "./class-edit-panel";
import {
  FRAMEWORK_CATEGORY,
  UNCATEGORIZED,
  buildClassRows,
  classCategories,
  filterClassRows,
  moveClassMeta,
  withClassMeta,
  type ClassFilter,
  type ClassSort
} from "./class-model";

const SORTS = [
  { value: "name", label: "Name A to Z" },
  { value: "name-desc", label: "Name Z to A" },
  { value: "used", label: "Most used" }
];
const FILTERS = [
  { value: "all", label: "All classes" },
  { value: "used", label: "Used" },
  { value: "unused", label: "Unused" },
  { value: "locked", label: "Locked" },
  { value: "empty", label: "Without styles" }
];

/**
 * Class manager (Bricks style): categories, the classes with their use counts, and the selected
 * class's CSS with rename, lock, duplicate and delete. Renames and deletes touch the open page at
 * once and the other saved pages when the Design System is saved.
 */
export function ClassesTab() {
  const nav = useDesignNav();
  const classes = useEditorStore((s) => s.project.classes);
  const meta = useEditorStore((s) => s.project.classMeta);
  const extraCategories = useEditorStore((s) => s.project.classCategories);
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const pageId = useEditorStore((s) => s.page?.id);
  const { framework } = useFramework();
  const [others, setOthers] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [include, setInclude] = useState(nav.params.className ?? "");
  const [only, setOnly] = useState<string[] | null>(nav.params.classNames ?? null);
  const [exclude, setExclude] = useState("");
  const [sort, setSort] = useState<ClassSort>("name");
  const [filter, setFilter] = useState<ClassFilter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(nav.params.className ?? null);
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pageId) return;
    let live = true;
    void classUsageAction(useEditorStore.getState().projectId, pageId).then((result) => {
      if (!live) return;
      if (result.error !== null) setError(result.error);
      else setOthers(result.data);
    });
    return () => {
      live = false;
    };
  }, [pageId]);

  const frameworkCss = useMemo(
    () => (framework ? frameworkStylesheet(framework) : ""),
    [framework]
  );
  const rows = useMemo(
    () =>
      buildClassRows({
        classes,
        meta,
        local: tree ? countClassUsage(tree) : {},
        others: others ?? {},
        framework: frameworkClasses(frameworkCss).map((c) => c.name)
      }),
    [classes, meta, tree, others, frameworkCss]
  );
  const cats = useMemo(() => classCategories(rows, extraCategories), [rows, extraCategories]);
  const shown = useMemo(() => {
    const list = filterClassRows(rows, { include, exclude, sort, filter, category });
    return only ? list.filter((r) => only.includes(r.name)) : list;
  }, [rows, include, exclude, sort, filter, category, only]);
  const userCategories = cats.filter((c) => c.editable).map((c) => c.name);
  const row = rows.find((r) => r.name === selected) ?? null;
  const store = useEditorStore.getState;

  const setMeta = useCallback(
    (name: string, patch: { category?: string | null; locked?: boolean }) =>
      store().patchProject({ classMeta: withClassMeta(store().project.classMeta, name, patch) }),
    [store]
  );

  function create() {
    const name = draft.trim().replace(/^\./, "");
    const problem = validClassName(name);
    if (problem) return setError(problem);
    if (!store().createClass(name)) return setError("That class already exists.");
    if (category && category !== UNCATEGORIZED && category !== FRAMEWORK_CATEGORY)
      setMeta(name, { category });
    setError(null);
    setDraft("");
    setSelected(name);
  }

  function duplicate(name: string) {
    let copy = `${name}-copy`;
    for (let n = 2; store().project.classes[copy]; n += 1) copy = `${name}-copy-${n}`;
    if (!store().duplicateClass(name, copy))
      return setError("Only classes with styles can be duplicated.");
    const m = store().project.classMeta[name];
    if (m?.category) setMeta(copy, { category: m.category });
    setSelected(copy);
  }

  function rename(from: string, to: string): string | null {
    if (store().project.classes[to] || rows.some((r) => r.name === to))
      return "That class already exists.";
    if (!store().renameClass(from, to)) return "The class could not be renamed.";
    store().queueOp({ type: "renameClass", from, to });
    store().patchProject({ classMeta: moveClassMeta(store().project.classMeta, from, to) });
    setSelected(to);
    return null;
  }

  function remove(name: string, replaceWith: string | null) {
    store().deleteClass(name, replaceWith);
    store().queueOp({ type: "deleteClass", name, to: replaceWith });
    store().patchProject({ classMeta: moveClassMeta(store().project.classMeta, name, null) });
    setDeleting(null);
    setSelected(null);
  }

  /** Classes of the project that are not locked can be selected for bulk delete. */
  const selectable = useMemo(
    () => shown.filter((r) => r.source === "project" && !r.locked).map((r) => r.name),
    [shown]
  );

  function deletePicked() {
    const names = [...picked].filter((n) =>
      rows.some((r) => r.name === n && r.source === "project" && !r.locked)
    );
    const used = names.reduce((sum, n) => sum + (rows.find((r) => r.name === n)?.used ?? 0), 0);
    const message =
      `Delete ${names.length} class${names.length === 1 ? "" : "es"}? ` +
      (used > 0 ? `Elements that use them (${used}) lose them.` : "No element uses them.");
    if (names.length === 0 || !window.confirm(message)) return;
    for (const name of names) {
      store().deleteClass(name, null);
      store().queueOp({ type: "deleteClass", name, to: null });
      store().patchProject({ classMeta: moveClassMeta(store().project.classMeta, name, null) });
    }
    setPicked(new Set());
    if (selected && names.includes(selected)) setSelected(null);
  }

  function addCategory(name: string): string | null {
    if (name === "" || name.length > 48) return "Give the category a name (up to 48 characters).";
    if (
      userCategories.some((c) => c.toLowerCase() === name.toLowerCase()) ||
      name.toLowerCase() === "uncategorized" ||
      name.toLowerCase() === "framework"
    )
      return "That category exists.";
    store().patchProject({ classCategories: [...extraCategories, name] });
    setCategory(name);
    return null;
  }

  function renameCategory(id: string, to: string): string | null {
    if (to === id) return null;
    if (to === "" || to.length > 48) return "Give the category a name (up to 48 characters).";
    if (userCategories.some((c) => c.toLowerCase() === to.toLowerCase()))
      return "That category exists.";
    let next = store().project.classMeta;
    for (const r of rows)
      if (r.category === id) next = withClassMeta(next, r.name, { category: to });
    store().patchProject({
      classMeta: next,
      classCategories: extraCategories.map((c) => (c === id ? to : c))
    });
    setCategory(to);
    return null;
  }

  function deleteCategory(id: string) {
    let next = store().project.classMeta;
    for (const r of rows)
      if (r.category === id) next = withClassMeta(next, r.name, { category: null });
    store().patchProject({
      classMeta: next,
      classCategories: extraCategories.filter((c) => c !== id)
    });
    setCategory(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ManagerToolbar
        include={include}
        exclude={exclude}
        onInclude={setInclude}
        onExclude={setExclude}
        sort={sort}
        sortOptions={SORTS}
        onSort={(v) => setSort(v as ClassSort)}
        filter={filter}
        filterOptions={FILTERS}
        onFilter={(v) => setFilter(v as ClassFilter)}
      />
      <div className="flex min-h-0 flex-1">
        <CategoryPanel
          title="Categories"
          total={rows.filter((r) => r.source === "project").length}
          items={cats}
          selected={category}
          onSelect={setCategory}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
        />
        <section
          className="flex w-72 shrink-0 flex-col border-r border-divider"
          aria-label="Classes"
        >
          <div className="flex flex-col gap-1 border-b border-divider px-4 py-3">
            <h3 className="text-small font-semibold">Classes ({shown.length})</h3>
            <SelectionBar
              noun="classes"
              total={selectable.length}
              selected={picked.size}
              onSelectAll={() => setPicked(new Set(selectable))}
              onClear={() => setPicked(new Set())}
              onDelete={deletePicked}
            />
          </div>
          {only ? (
            <button
              type="button"
              onClick={() => setOnly(null)}
              className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-medium bg-default-100 px-3 py-1.5 text-left text-tiny hover:bg-default-200"
            >
              <span className="min-w-0 truncate">{nav.params.classLabel ?? "Filtered"}</span>
              <span aria-label="Show all classes">Show all</span>
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="px-4 pt-2 text-tiny text-danger">
              {error}
            </p>
          ) : null}
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {others === null && !error ? (
              <li className="p-4 text-small text-default-500">Loading classes…</li>
            ) : shown.length === 0 ? (
              <li className="p-4 text-small text-default-500">
                {include || filter !== "all"
                  ? "No class matches."
                  : "No classes yet. Add one below or from an element."}
              </li>
            ) : (
              shown.map((r) => (
                <li
                  key={`${r.source}:${r.name}`}
                  className={
                    "flex items-center border-b border-divider transition-colors duration-300 " +
                    (selected === r.name
                      ? "bg-default-800 text-default-50"
                      : "hover:bg-default-100")
                  }
                >
                  {r.source === "project" && !r.locked ? (
                    <input
                      type="checkbox"
                      checked={picked.has(r.name)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(r.name);
                        else next.delete(r.name);
                        setPicked(next);
                      }}
                      aria-label={`Select .${r.name}`}
                      className="ml-4 h-4 w-4 shrink-0 cursor-pointer accent-default-800"
                    />
                  ) : (
                    <span aria-hidden className="ml-4 h-4 w-4 shrink-0" />
                  )}
                  <button
                    type="button"
                    aria-current={selected === r.name}
                    onClick={() => setSelected(r.name)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left font-mono text-small"
                  >
                    <span className="min-w-0 flex-1 truncate">.{r.name}</span>
                    {r.locked && r.source === "project" ? (
                      <span className="text-tiny opacity-70">locked</span>
                    ) : null}
                    <span
                      className="text-tiny opacity-70"
                      title={`${r.used} element${r.used === 1 ? "" : "s"}`}
                    >
                      {r.used}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <form
            className="flex items-center gap-2 border-t border-divider p-2"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <input
              aria-label="New class name"
              placeholder="New class name…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-medium border border-divider bg-transparent px-3 font-mono text-small outline-none focus-visible:border-default-800"
            />
            <ActionButton size="sm" type="submit" isDisabled={draft.trim() === ""}>
              <Icon name="ph:plus" width={14} height={14} />
              Add
            </ActionButton>
          </form>
        </section>
        <section className="min-w-0 flex-1 overflow-y-auto" aria-label="Edit class">
          <h3 className="border-b border-divider px-4 py-3 text-small font-semibold">
            {row ? `Edit .${row.name}` : "Edit"}
          </h3>
          {row ? (
            <ClassEditPanel
              key={row.name}
              row={row}
              categories={userCategories}
              frameworkRules={
                row.source === "framework" ? frameworkClassRules(frameworkCss, row.name) : ""
              }
              onRename={(to) => rename(row.name, to)}
              onDuplicate={() => duplicate(row.name)}
              onDelete={() => setDeleting(row.name)}
              onLock={() => setMeta(row.name, { locked: !row.locked })}
              onCategory={(c) => setMeta(row.name, { category: c })}
            />
          ) : (
            <p className="p-4 text-small text-default-500">Select a class to edit its CSS.</p>
          )}
        </section>
      </div>
      {deleting ? (
        <ClassDeleteDialog
          name={deleting}
          used={rows.find((r) => r.name === deleting)?.used ?? 0}
          replacements={Object.keys(classes).filter((n) => n !== deleting)}
          onConfirm={(to) => remove(deleting, to)}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
