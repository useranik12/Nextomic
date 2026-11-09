"use client";

import {
  CONDITION_KIND_LABELS,
  CONDITION_KINDS,
  CONDITION_OP_LABELS,
  CONDITION_OPS,
  patternProblem,
  VALUELESS_CONDITION_OPS,
  type Condition,
  type ConditionKind,
  type ConditionOp
} from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { BoltInput } from "../right-panel/bolt-input";
import { ElementConditionFields } from "./element-condition-fields";
import { ListChipsInput } from "./list-chips-input";

// One condition. Its type is a value comparison (value, operator, compare value; both take static
// text mixed with {{ tags }}) or a class, ID or attribute check on an element.

const KIND_OPTIONS = CONDITION_KINDS.map((kind) => ({
  value: kind,
  label: CONDITION_KIND_LABELS[kind]
}));

const OP_OPTIONS = CONDITION_OPS.map((op) => ({ value: op, label: CONDITION_OP_LABELS[op] }));

const LIST_OPS: readonly string[] = ["isIn", "isNotIn"];

const RIGHT_HINT: Partial<Record<ConditionOp, string>> = {
  isIn: "Type a comma or press Enter to add a value. A tag that gives a list also works.",
  isNotIn: "Type a comma or press Enter to add a value. A tag that gives a list also works.",
  matches: "A regular expression, like ^[A-Z]{2}-[0-9]+$.",
  greaterThan: "A number or a date.",
  lessThan: "A number or a date."
};

/** A fresh condition of another type (its fields mean different things, so they start empty). */
const ofKind = (condition: Condition, kind: ConditionKind): Condition => ({
  id: condition.id,
  kind,
  left: "",
  op: kind === "value" ? "equals" : "has",
  right: ""
});

function ValueFields({
  condition,
  onChange
}: {
  condition: Condition;
  onChange: (next: Condition) => void;
}) {
  const op = condition.op as ConditionOp;
  const valueless = VALUELESS_CONDITION_OPS.includes(op);
  // A pattern with tags is checked when the page renders; a static one is checked here.
  const problem =
    op === "matches" && condition.right && !condition.right.includes("{{")
      ? patternProblem(condition.right)
      : null;
  return (
    <>
      <BoltInput
        label="Value"
        placeholder="{{ app.cart.length }}"
        value={condition.left}
        onValueChange={(left) => onChange({ ...condition, left })}
      />
      <SelectField
        compact
        label="Operator"
        hideLabel
        options={OP_OPTIONS}
        value={op}
        onValueChange={(next) => onChange({ ...condition, op: next as ConditionOp })}
      />
      {valueless ? null : LIST_OPS.includes(op) ? (
        <ListChipsInput
          label="Compare with"
          value={condition.right}
          description={RIGHT_HINT[op]}
          onValueChange={(right) => onChange({ ...condition, right })}
        />
      ) : (
        <BoltInput
          label="Compare with"
          value={condition.right}
          description={RIGHT_HINT[op]}
          isInvalid={problem !== null}
          errorMessage={problem ?? undefined}
          onValueChange={(right) => onChange({ ...condition, right })}
        />
      )}
    </>
  );
}

export function ConditionRow({
  condition,
  onChange,
  onRemove
}: {
  condition: Condition;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-large border border-default-200 p-2.5">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <SelectField
            compact
            label="Condition type"
            options={KIND_OPTIONS}
            value={condition.kind}
            onValueChange={(kind) =>
              kind !== condition.kind && onChange(ofKind(condition, kind as ConditionKind))
            }
          />
        </div>
        <button
          type="button"
          aria-label="Remove condition"
          onClick={onRemove}
          className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-100 hover:text-danger"
        >
          <Icon name="ph:trash" width={14} height={14} />
        </button>
      </div>
      {condition.kind === "value" ? (
        <ValueFields condition={condition} onChange={onChange} />
      ) : (
        <ElementConditionFields
          condition={{ ...condition, kind: condition.kind }}
          onChange={onChange}
        />
      )}
    </li>
  );
}
