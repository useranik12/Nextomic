"use client";

import {
  CONDITION_OP_LABELS,
  CONDITION_OPS,
  patternProblem,
  VALUELESS_CONDITION_OPS,
  type Condition,
  type ConditionOp
} from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { BoltInput } from "../right-panel/bolt-input";

// One condition: the value tested, the operator, and the compare value (hidden for operators
// that need none). Both values take static text mixed with {{ tags }}.

const OP_OPTIONS = CONDITION_OPS.map((op) => ({ value: op, label: CONDITION_OP_LABELS[op] }));

const RIGHT_HINT: Partial<Record<ConditionOp, string>> = {
  isIn: "Comma separated (a, b, c) or a tag that gives a list.",
  isNotIn: "Comma separated (a, b, c) or a tag that gives a list.",
  matches: "A regular expression, like ^[A-Z]{2}-[0-9]+$.",
  greaterThan: "A number or a date.",
  lessThan: "A number or a date."
};

export function ConditionRow({
  condition,
  onChange,
  onRemove
}: {
  condition: Condition;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}) {
  const valueless = VALUELESS_CONDITION_OPS.includes(condition.op);
  // A pattern with tags is checked when the page renders; a static one is checked here.
  const problem =
    condition.op === "matches" && condition.right && !condition.right.includes("{{")
      ? patternProblem(condition.right)
      : null;
  return (
    <li className="flex flex-col gap-2 rounded-large border border-default-200 p-2.5">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <BoltInput
            label="Value"
            placeholder="{{ app.cart.length }}"
            value={condition.left}
            onValueChange={(left) => onChange({ ...condition, left })}
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
      <SelectField
        compact
        label="Operator"
        hideLabel
        options={OP_OPTIONS}
        value={condition.op}
        onValueChange={(op) => onChange({ ...condition, op: op as ConditionOp })}
      />
      {valueless ? null : (
        <BoltInput
          label="Compare with"
          value={condition.right}
          description={RIGHT_HINT[condition.op]}
          isInvalid={problem !== null}
          errorMessage={problem ?? undefined}
          onValueChange={(right) => onChange({ ...condition, right })}
        />
      )}
    </li>
  );
}
