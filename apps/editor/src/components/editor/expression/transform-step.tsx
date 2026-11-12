"use client";

import {
  transformDef,
  type TransformParam,
  type TransformStep,
  type TransformValue
} from "@nextomic/schema";
import { FormInput, SelectField } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { Icon } from "@/lib/icons/Icon";

// One step of a transform chain in the bolt modal: its name, its settings, and buttons to move or
// remove it. A step whose input no longer fits (an earlier step changed the kind) is flagged.

const ICON_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-300 hover:bg-default-hover hover:text-foreground disabled:opacity-30";

function ParamField({
  param,
  value,
  onChange
}: {
  param: TransformParam;
  value: TransformValue | undefined;
  onChange: (value: TransformValue) => void;
}) {
  if (param.type === "select")
    return (
      <SelectField
        compact
        label={param.label}
        options={param.options ?? []}
        value={String(value ?? "")}
        onValueChange={onChange}
      />
    );
  if (param.type === "boolean")
    return (
      <SwitchRow
        label={param.label}
        tip={param.label}
        selected={value === true}
        onChange={onChange}
      />
    );
  return (
    <FormInput
      compact
      label={param.label}
      placeholder={param.placeholder}
      type={param.type === "number" ? "number" : "text"}
      spellCheck="false"
      value={String(value ?? "")}
      onValueChange={(text) => {
        if (param.type !== "number") return onChange(text);
        const n = Number(text);
        if (text.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function TransformStepCard({
  step,
  index,
  count,
  fits,
  onChange,
  onMove,
  onRemove
}: {
  step: TransformStep;
  index: number;
  count: number;
  /** False when the value going in is not a kind this step takes. */
  fits: boolean;
  onChange: (step: TransformStep) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const def = transformDef(step.id);
  if (!def) return null;
  const params = def.params.filter((p) => !p.when || p.when(step.values));
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-default p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-default-hover text-xs text-body">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {def.label}
          <span className="ml-2 text-xs font-normal text-muted">{def.group}</span>
        </span>
        <button
          type="button"
          aria-label={`Move ${def.label} up`}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
          className={ICON_BUTTON}
        >
          <Icon name="ph:arrow-up" width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label={`Move ${def.label} down`}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
          className={ICON_BUTTON}
        >
          <Icon name="ph:arrow-down" width={14} height={14} />
        </button>
        <button
          type="button"
          aria-label={`Remove ${def.label}`}
          onClick={onRemove}
          className={ICON_BUTTON + " hover:text-danger"}
        >
          <Icon name="ph:trash" width={14} height={14} />
        </button>
      </div>
      {!fits ? (
        <p role="status" className="text-xs text-warning">
          The value going into this step is not a {def.accepts.join(" or ")}.
        </p>
      ) : null}
      {params.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {params.map((param) => (
            <ParamField
              key={param.key}
              param={param}
              value={step.values[param.key]}
              onChange={(value) =>
                onChange({ ...step, values: { ...step.values, [param.key]: value } })
              }
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}
