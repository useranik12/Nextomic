"use client";

import { STATE_TYPE_LABELS, type AvailableVariable } from "@nextomic/schema";

// Pieces of the [variable] list: where the placeholder at the caret is, which variables match it,
// and one row of the list.

/** The `[name]` around the caret, while the caret is inside its brackets. */
export function placeholderAt(
  value: string,
  caret: number
): { from: number; to: number; search: string } | null {
  const before = /\[([A-Za-z0-9_]*)$/.exec(value.slice(0, caret));
  const after = /^([A-Za-z0-9_]*)\]/.exec(value.slice(caret));
  if (!before || !after) return null;
  const search = before[1] ?? "";
  return { from: caret - search.length, to: caret + (after[1] ?? "").length, search };
}

export const matches = (variables: readonly AvailableVariable[], search: string) => {
  const q = search.toLowerCase();
  const found = variables.filter((v) => v.name.toLowerCase().includes(q));
  return found.sort(
    (a, b) =>
      Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q))
  );
};

const FROM_LABEL: Record<AvailableVariable["from"], string> = {
  call: "",
  group: "Group",
  server: "Server"
};

/** One variable: name, where it comes from, type, and default value. */
export function VariableRow({
  variable,
  active,
  id,
  onPick
}: {
  variable: AvailableVariable;
  active: boolean;
  id: string;
  onPick: () => void;
}) {
  const type = `${STATE_TYPE_LABELS[variable.type]}${variable.isList ? " list" : ""}`;
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onPick();
      }}
      className={`flex cursor-pointer flex-col gap-0.5 rounded-medium px-2.5 py-1.5 ${active ? "bg-default-100" : "hover:bg-default-50"}`}
    >
      <span className="flex items-center gap-2">
        <span className="truncate font-mono text-small text-foreground">{variable.name}</span>
        {FROM_LABEL[variable.from] ? (
          <span className="rounded-full bg-default-100 px-1.5 text-tiny text-default-500">
            {FROM_LABEL[variable.from]}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-tiny text-primary-600 dark:text-primary-400">
          {type}
        </span>
      </span>
      <span className="truncate font-mono text-tiny text-default-500">
        {variable.from === "server"
          ? "Filled by the server"
          : variable.defaultValue
            ? `Default: ${variable.defaultValue}`
            : "No default value"}
      </span>
    </li>
  );
}
