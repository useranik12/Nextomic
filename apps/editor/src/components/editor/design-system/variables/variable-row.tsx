"use client";

import {
  VARIABLE_NAME_PATTERN,
  VARIABLE_PREFIX,
  VARIABLE_TYPE_LABEL,
  variableSchema,
  type ProjectVariable
} from "@nextomic/schema";
import { useState } from "react";
import { ColorField } from "@/components/ui/color-field";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../../store/editor-store";
import { useDesignNav } from "../design-nav";
import { VariableFields } from "../variable-editor";
import type { VarRow } from "./variable-model";

const inputClass =
  "h-8 min-w-0 flex-1 rounded-full border-2 border-default-200 bg-transparent px-3 font-mono text-small outline-none focus:border-default-800 disabled:opacity-60";

function RowButton({
  label,
  onPress,
  danger,
  icon
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  icon: "ph:trash" | "ph:sliders-horizontal" | "ph:arrow-square-out";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onPress}
      className={`rounded-full p-1.5 text-default-600 transition-colors duration-300 ${danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-default-100"}`}
    >
      <Icon name={icon} width={15} height={15} />
    </button>
  );
}

/** A variable of the project: rename, value, category and type, delete (renames wait for Save). */
export function ProjectVariableRow({
  row,
  variable,
  used,
  categories,
  open,
  onToggle,
  onError,
  checked,
  onCheck
}: {
  checked: boolean;
  onCheck: (on: boolean) => void;
  row: VarRow;
  variable: ProjectVariable;
  used: number;
  categories: string[];
  open: boolean;
  onToggle: () => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState(variable.name);
  const taken = useEditorStore((s) => s.project.variables);

  function commitName() {
    const to = name.trim();
    if (to === variable.name) return;
    if (!VARIABLE_NAME_PATTERN.test(to) || to.length > 48) {
      setName(variable.name);
      return onError("Use lowercase letters, digits and -, starting with a letter.");
    }
    if (taken.some((v) => v.name === to)) {
      setName(variable.name);
      return onError("That name is taken.");
    }
    const store = useEditorStore.getState();
    if (store.renameVariable(variable.name, to))
      store.queueOp({ type: "renameVariable", from: variable.name, to });
    onError(null);
  }

  function edit(next: ProjectVariable) {
    const parsed = variableSchema.safeParse(next);
    if (!parsed.success) return onError(parsed.error.issues[0]?.message ?? "Invalid value.");
    onError(null);
    useEditorStore.getState().upsertVariables([parsed.data]);
  }

  function remove() {
    if (
      used > 0 &&
      !window.confirm(
        `${row.cssName} is used ${used} time${used === 1 ? "" : "s"}. Delete it anyway?`
      )
    )
      return;
    useEditorStore.getState().deleteVariable(variable.name);
  }

  return (
    <li className="border-b border-divider">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          aria-label={`Select ${row.cssName}`}
          className="h-4 w-4 shrink-0 cursor-pointer accent-default-800"
        />
        <span aria-hidden className="shrink-0 font-mono text-tiny text-default-500">
          {VARIABLE_PREFIX}
        </span>
        <input
          aria-label={`Name of ${row.cssName}`}
          value={name}
          spellCheck={false}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setName(variable.name);
          }}
          className={inputClass}
        />
        <span aria-hidden className="text-default-400">
          =
        </span>
        {variable.type === "color" ? (
          <ColorField
            className="flex-1"
            label={`Value of ${row.cssName}`}
            value={variable.value}
            onChange={(value) => edit({ ...variable, value })}
          />
        ) : (
          <input
            aria-label={`Value of ${row.cssName}`}
            value={variable.value}
            spellCheck={false}
            disabled={variable.type === "fluid-size"}
            onChange={(e) => edit({ ...variable, value: e.target.value })}
            className={inputClass}
          />
        )}
        <span className="hidden w-20 shrink-0 text-tiny text-default-500 xl:block">
          {VARIABLE_TYPE_LABEL[variable.type]}
        </span>
        <span
          className="w-6 shrink-0 text-right text-tiny text-default-500"
          title={`${used} reference${used === 1 ? "" : "s"}`}
        >
          {used}
        </span>
        <RowButton
          label={`${open ? "Close" : "Edit"} type and category of ${row.cssName}`}
          icon="ph:sliders-horizontal"
          onPress={onToggle}
        />
        <RowButton label={`Delete ${row.cssName}`} icon="ph:trash" danger onPress={remove} />
      </div>
      {open ? (
        <div className="px-3 pb-3">
          <VariableFields variable={variable} onChange={edit} groups={categories} />
        </div>
      ) : null}
    </li>
  );
}

/** A framework variable: editable when it is a plain variable, otherwise it points at the tab that owns it. */
export function FrameworkVariableRow({
  row,
  onEdit
}: {
  row: VarRow;
  onEdit: (name: string, value: string) => void;
}) {
  const nav = useDesignNav();
  return (
    <li className="flex items-center gap-2 border-b border-divider px-3 py-1.5">
      <code className="w-48 shrink-0 truncate text-small" title={row.cssName}>
        {row.cssName}
      </code>
      <span aria-hidden className="text-default-400">
        =
      </span>
      {row.readOnly ? (
        <code className="min-w-0 flex-1 truncate text-tiny text-default-600" title={row.value}>
          {row.value}
        </code>
      ) : row.type === "color" ? (
        <ColorField
          className="flex-1"
          label={`Value of ${row.cssName}`}
          value={row.value}
          onChange={(v) => onEdit(row.name, v)}
        />
      ) : (
        <input
          aria-label={`Value of ${row.cssName}`}
          value={row.value}
          spellCheck={false}
          onChange={(e) => onEdit(row.name, e.target.value)}
          className={inputClass}
        />
      )}
      {row.dark ? (
        <span className="hidden shrink-0 text-tiny text-default-500 xl:block">dark {row.dark}</span>
      ) : null}
      {row.editIn ? (
        <RowButton
          label={`Edit ${row.cssName} in ${row.editIn}`}
          icon="ph:arrow-square-out"
          onPress={() => nav.go(row.editIn ?? "colors")}
        />
      ) : null}
    </li>
  );
}
