"use client";

import {
  inferJsonType,
  previewJson,
  readJsonPath,
  REST_VALUE_TYPES,
  type RestJsonPath
} from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";

/** A preview colored like the design: text orange, numbers violet, objects teal, nothing gray. */
export function ValuePreview({ value }: { value: unknown }) {
  const sample = Array.isArray(value) ? value.find((v) => v !== null) : value;
  const color =
    value === null || value === undefined
      ? "text-default-400"
      : typeof sample === "number"
        ? "text-violet-500"
        : typeof sample === "string"
          ? "text-orange-500"
          : "text-teal-500";
  return (
    <span className={`block truncate py-1.5 font-mono text-tiny ${color}`}>
      {previewJson(value)}
    </span>
  );
}

/** Picks a path for the response viewer: with any picked, it shows only those paths' values. */
export function EyeButton({
  shown,
  label,
  onToggle
}: {
  shown: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={shown}
      aria-label={`Show ${label} in the response viewer`}
      data-tip={shown ? "Shown in the response viewer" : "Show in the response viewer"}
      onClick={onToggle}
      className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-default-100 ${shown ? "bg-primary-500/10 text-primary-600 dark:text-primary-400" : "text-default-400 hover:text-foreground"}`}
    >
      <Icon name="ph:eye" width={16} height={16} />
    </button>
  );
}

/** A path's last field as a name: `$.data[:].monitor_tag` gives `monitor_tag`. */
function nameFor(path: string, taken: readonly string[]): string {
  const last = /([A-Za-z_]\w*)[^A-Za-z_]*$/.exec(path)?.[1] ?? "value";
  let name = last;
  for (let i = 2; taken.includes(name); i++) name = `${last}_${i}`;
  return name;
}

/** A new JSON path row, typed from the last response when there is one. */
export function newJsonPath(path: string, json: unknown, taken: readonly string[]): RestJsonPath {
  const typed =
    json === null ? { type: "string", isList: false } : inferJsonType(readJsonPath(json, path));
  const type = (REST_VALUE_TYPES as readonly string[]).includes(typed.type)
    ? (typed.type as RestJsonPath["type"])
    : "json";
  return {
    id: crypto.randomUUID(),
    path,
    name: nameFor(path, taken),
    type,
    ref: "",
    isList: typed.isList
  };
}

/** Toggles a key in a set held in state. */
export function toggleIn(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
