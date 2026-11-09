"use client";

import {
  chainKinds,
  compileTransformChain,
  kindOf,
  newTransformStep,
  runExpression,
  tagText,
  toText,
  TRANSFORM_GROUPS,
  transformDef,
  transformsFor,
  type TransformChain,
  type TransformKind
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { TransformStepCard } from "./transform-step";

// The Transform view of the bolt modal (owner decision 2026-11-09, option A): the picked tag, a
// typed chain of steps, a fallback for empty results, a live preview, and Insert. The chain is
// written into the field as a plain expression; nothing else is stored.

const KIND_LABELS: Record<TransformKind, string> = {
  string: "text",
  number: "number",
  boolean: "true / false",
  array: "list",
  object: "object",
  date: "date",
  null: "empty",
  any: "any value"
};

/** The resting choice of the Add list (react-aria cannot key an item by ""). */
const ADD = "add";

/** The base tag's sample value decides the starting kind; empty or unknown fits every step. */
function startKind(base: string, scope: Record<string, unknown> | null): TransformKind {
  if (!scope) return "any";
  try {
    const kind = kindOf(runExpression(base, scope));
    return kind === "null" ? "any" : kind;
  } catch {
    return "any";
  }
}

function preview(code: string, scope: Record<string, unknown> | null) {
  if (!scope) return { text: "No preview values here.", error: false };
  try {
    const out = toText(runExpression(code, scope));
    return { text: out === "" ? "(empty)" : out, error: false };
  } catch (error) {
    return { text: error instanceof Error ? error.message : "This does not work.", error: true };
  }
}

export function TransformPanel({
  initial,
  label,
  scope,
  replacing,
  onBack,
  onInsert
}: {
  initial: TransformChain;
  /** The tag's display name, when known. */
  label?: string;
  scope: Record<string, unknown> | null;
  /** True when Insert replaces a tag already in the field. */
  replacing: boolean;
  onBack: () => void;
  onInsert: (expression: string) => void;
}) {
  const [chain, setChain] = useState(initial);
  const start = useMemo(() => startKind(chain.base, scope), [chain.base, scope]);
  const kinds = chainKinds(start, chain.steps);
  const outKind = kinds[kinds.length - 1] ?? "any";
  const code = compileTransformChain(chain, start);
  const result = preview(code, scope);
  const options = transformsFor(outKind);
  const addOptions = [
    { value: ADD, label: "Add a transform" },
    ...TRANSFORM_GROUPS.flatMap((group) =>
      options
        .filter((t) => t.group === group)
        .map((t) => ({ value: t.id, label: `${group}: ${t.label}` }))
    )
  ];
  const setSteps = (steps: TransformChain["steps"]) => setChain({ ...chain, steps });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the dynamic tags"
          className="flex h-8 w-8 items-center justify-center rounded-full text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
        >
          <Icon name="ph:arrow-left" width={16} height={16} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-foreground">{label ?? "Transform"}</p>
          <p className="truncate font-mono text-tiny text-default-500">{tagText(chain.base)}</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-default-100 px-3 py-1 text-tiny text-default-600">
          Starts as {KIND_LABELS[start]}
        </span>
      </div>
      {chain.steps.length === 0 ? (
        <p className="text-tiny text-default-500">
          No transforms yet. Add one to change how the value shows, like rounding a price or
          formatting a date.
        </p>
      ) : (
        <ol aria-label="Transforms" className="flex flex-col gap-2">
          {chain.steps.map((step, i) => (
            <TransformStepCard
              key={`${i}-${step.id}`}
              step={step}
              index={i}
              count={chain.steps.length}
              fits={(() => {
                const kind = kinds[i] ?? "any";
                const def = transformDef(step.id);
                return kind === "any" || !def || def.accepts.includes(kind as never);
              })()}
              onChange={(next) => setSteps(chain.steps.map((s, j) => (j === i ? next : s)))}
              onRemove={() => setSteps(chain.steps.filter((_, j) => j !== i))}
              onMove={(to) => {
                const steps = [...chain.steps];
                const [moved] = steps.splice(i, 1);
                if (moved) steps.splice(to, 0, moved);
                setSteps(steps);
              }}
            />
          ))}
        </ol>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          compact
          label="Add a transform"
          hideLabel
          options={addOptions}
          value={ADD}
          isDisabled={options.length === 0}
          onValueChange={(id) => id !== ADD && setSteps([...chain.steps, newTransformStep(id)])}
        />
        <FormInput
          compact
          aria-label="Fallback when empty"
          placeholder="Fallback when empty (optional)"
          value={chain.fallback}
          onValueChange={(fallback) => setChain({ ...chain, fallback })}
        />
      </div>
      <div className="flex flex-col gap-1 rounded-large border border-default-200 p-3">
        <span className="text-tiny font-medium text-default-600">
          Preview ({KIND_LABELS[outKind]})
        </span>
        <output
          aria-live="polite"
          className={"break-all text-small " + (result.error ? "text-danger" : "text-foreground")}
        >
          {result.text}
        </output>
        <code className="break-all font-mono text-tiny text-default-500">{tagText(code)}</code>
      </div>
      <div className="flex justify-end gap-2">
        <ActionButton tone="ghost" size="sm" onPress={onBack}>
          Cancel
        </ActionButton>
        <ActionButton size="sm" onPress={() => onInsert(code)}>
          {replacing ? "Update tag" : "Insert"}
        </ActionButton>
      </div>
    </div>
  );
}
