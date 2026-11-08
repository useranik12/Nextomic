"use client";

import { Checkbox } from "@heroui/react";
import {
  parseJsonPath,
  readJsonPath,
  recommendedJsonPaths,
  REST_VALUE_TYPES,
  type RestJsonPath
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { TypePicker } from "../data-types/type-picker";
import { compactFieldClass } from "../right-panel/setting-row";
import { EyeButton, newJsonPath, toggleIn, ValuePreview } from "./json-path-parts";

const GRID =
  "grid grid-cols-[minmax(10rem,1.4fr)_minmax(7rem,1fr)_minmax(8rem,1.4fr)_minmax(10rem,1.1fr)_3rem_2rem_2rem] items-start gap-2";

function PathRow({
  item,
  json,
  hidden,
  onToggle,
  onChange,
  onDelete
}: {
  item: RestJsonPath;
  json: unknown;
  hidden: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<RestJsonPath>) => void;
  onDelete: () => void;
}) {
  const parsed = parseJsonPath(item.path);
  const error = "error" in parsed ? parsed.error : null;
  return (
    <div className={GRID}>
      <div>
        <input
          aria-label="JSON path"
          value={item.path}
          onChange={(e) => onChange({ path: e.target.value })}
          className={`${compactFieldClass} font-mono ${error ? "!border-danger" : ""}`}
        />
        {error ? <p className="mt-0.5 px-2 text-tiny text-danger">{error}</p> : null}
      </div>
      <input
        aria-label="Name"
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value.trim() })}
        className={`${compactFieldClass} font-mono`}
      />
      <ValuePreview value={json === null ? null : readJsonPath(json, item.path)} hidden={hidden} />
      <TypePicker
        label={`Type of ${item.name}`}
        spec={item}
        types={REST_VALUE_TYPES}
        onChange={(next) => onChange({ type: next.type as RestJsonPath["type"], ref: next.ref })}
      />
      <div className="flex h-8 items-center">
        <Checkbox
          size="sm"
          aria-label={`${item.name} is a list`}
          isSelected={item.isList}
          onValueChange={(isList) => onChange({ isList })}
        />
      </div>
      <EyeButton hidden={hidden} label={`preview of ${item.name}`} onToggle={onToggle} />
      <button
        type="button"
        aria-label={`Delete ${item.name}`}
        onClick={onDelete}
        className="flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-danger/10"
      >
        <Icon name="ph:trash" width={16} height={16} />
      </button>
    </div>
  );
}

/** JSON Paths: named values read from the response, plus recommended paths from the last test. */
export function JsonPaths({
  paths,
  json,
  onChange
}: {
  paths: RestJsonPath[];
  json: unknown;
  onChange: (next: RestJsonPath[]) => void;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  const names = paths.map((p) => p.name);
  const add = (path: string) => onChange([...paths, newJsonPath(path, json, names)]);
  const recommended =
    json === null ? [] : recommendedJsonPaths(json).filter((p) => !paths.some((x) => x.path === p));

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-small font-medium text-foreground">JSON Paths</h4>
      <p className="text-tiny text-default-500">
        $ is the response. Write .name for a field, [0] for an item and [:] for every item (that
        gives a list).
      </p>
      {paths.length > 0 ? (
        <div className={`${GRID} text-tiny text-default-500`}>
          <span>JSON Path</span>
          <span>Name</span>
          <span>Response Preview</span>
          <span>Type</span>
          <span>List</span>
          <span className="sr-only">Preview</span>
          <span className="sr-only">Delete</span>
        </div>
      ) : null}
      {paths.map((p) => (
        <PathRow
          key={p.id}
          item={p}
          json={json}
          hidden={hidden.has(p.id)}
          onToggle={() => setHidden((s) => toggleIn(s, p.id))}
          onChange={(patch) => onChange(paths.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))}
          onDelete={() => onChange(paths.filter((x) => x.id !== p.id))}
        />
      ))}
      <ActionButton
        size="sm"
        tone="ghost"
        className="self-start border border-default-200"
        onPress={() => add("$")}
      >
        <Icon name="ph:plus" width={14} height={14} />
        Add JSON Path
      </ActionButton>
      {recommended.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-divider pt-4">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex w-fit items-center gap-1 text-small font-medium text-foreground"
          >
            Recommended
            {open ? (
              <Icon name="ph:caret-down" width={14} height={14} />
            ) : (
              <Icon name="ph:caret-right" width={14} height={14} />
            )}
          </button>
          {open
            ? recommended.map((path) => (
                <div
                  key={path}
                  className="grid grid-cols-[minmax(8rem,1fr)_minmax(10rem,2fr)_2rem_auto] items-center gap-3"
                >
                  <span className="font-mono text-small text-foreground">{path}</span>
                  <ValuePreview
                    value={readJsonPath(json, path)}
                    hidden={hidden.has(`rec:${path}`)}
                  />
                  <EyeButton
                    hidden={hidden.has(`rec:${path}`)}
                    label={`preview of ${path}`}
                    onToggle={() => setHidden((s) => toggleIn(s, `rec:${path}`))}
                  />
                  <ActionButton
                    size="sm"
                    tone="ghost"
                    className="border border-default-200"
                    onPress={() => add(path)}
                  >
                    <Icon name="ph:plus" width={14} height={14} />
                    Add JSON Path
                  </ActionButton>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
