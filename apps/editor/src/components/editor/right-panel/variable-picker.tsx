"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { variableRef, type ProjectVariable, type VariableType } from "@nextomic/schema";
import { useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";

/** Variable types that make sense for a CSS property, so the list stays short. */
export function typesForProperty(property: string): VariableType[] | null {
  if (/color$/.test(property) || property === "outline" || property === "border")
    return ["color", "string"];
  if (property === "font-family") return ["font-family", "string"];
  if (property === "font-weight") return ["font-weight", "number"];
  if (/shadow$/.test(property)) return ["shadow", "string"];
  if (/radius$/.test(property)) return ["radius", "size", "fluid-size"];
  if (["opacity", "order", "flex-grow", "flex-shrink", "z-index", "line-height"].includes(property))
    return ["number", "string"];
  if (
    /(margin|padding|gap|width|height|top|right|bottom|left|size|spacing|basis|flex-basis)/.test(
      property
    )
  )
    return ["size", "fluid-size"];
  return null;
}

/** The variable button beside a Design value: pick a project variable to use as the value. */
export function VariablePicker({
  label,
  property,
  onPick
}: {
  label: string;
  property: string;
  onPick: (ref: string) => void;
}) {
  const variables = useEditorStore((s) => s.project.variables);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const types = typesForProperty(property);
    const q = query.trim().toLowerCase();
    return variables.filter(
      (v: ProjectVariable) =>
        (!types || types.includes(v.type)) && (!q || v.name.toLowerCase().includes(q))
    );
  }, [variables, property, query]);

  return (
    <Popover isOpen={open} onOpenChange={setOpen} placement="bottom-end">
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`Use a variable for ${label}`}
          title="Use a design system variable"
          className="flex h-6 w-6 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-300 hover:text-foreground"
        >
          <Icon name="ph:brackets-curly" width={14} height={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 items-stretch gap-2 p-2">
        {variables.length > 6 ? (
          <input
            autoFocus
            type="search"
            aria-label="Search variables"
            placeholder="Search variables"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-medium bg-default-100 px-2.5 text-small outline-none focus-visible:ring-2 focus-visible:ring-default-800/30"
          />
        ) : null}
        <ul className="max-h-64 overflow-y-auto">
          {list.length === 0 ? (
            <li className="p-2 text-small text-default-500">
              {variables.length === 0
                ? "No variables yet. Create them in the Design System."
                : "No variable fits this property."}
            </li>
          ) : (
            list.map((v) => (
              <li key={v.name}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(variableRef(v.name));
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-medium px-2 py-1.5 text-left hover:bg-default-100"
                >
                  {v.type === "color" ? (
                    <span
                      aria-hidden
                      style={{ background: v.value }}
                      className="h-4 w-4 shrink-0 rounded border border-divider"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-mono text-small">{v.name}</span>
                  <span className="max-w-[90px] truncate font-mono text-tiny text-default-500">
                    {v.value}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
