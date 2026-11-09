"use client";

import { getElementDefinition } from "@nextomic/renderer";
import {
  ELEMENT_CONDITION_OP_LABELS,
  ELEMENT_CONDITION_OPS,
  findNode,
  walkElements,
  type Condition,
  type ElementNode
} from "@nextomic/schema";
import { useMemo } from "react";
import { SelectField } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";
import { BoltInput } from "../right-panel/bolt-input";

// Class, ID and attribute conditions: the element checked (this one or another on the page),
// has / does not have, and the class name, ID or attribute name (with an optional value).

const SELF = "self";

const OP_OPTIONS = ELEMENT_CONDITION_OPS.map((op) => ({
  value: op,
  label: ELEMENT_CONDITION_OP_LABELS[op]
}));

const NAME_LABEL = { class: "Class name", id: "ID", attribute: "Attribute name" } as const;
const NAME_PLACEHOLDER = { class: "is-active", id: "nxtomc-ab12cd34", attribute: "aria-expanded" };

const labelOf = (node: ElementNode) => {
  const name = node.name ?? getElementDefinition(node.type)?.label ?? node.type;
  return node.htmlId ? `${name} #${node.htmlId}` : name;
};

/** Every element of the page except the selected one, as picker options. */
function useTargetOptions() {
  const tree = useEditorStore((s) => s.doc?.tree);
  const selectedId = useEditorStore((s) => s.selectedId);
  return useMemo(() => {
    const options = [{ value: SELF, label: "This element" }];
    if (!tree) return options;
    walkElements(tree, (node, parent) => {
      if (parent && node.id !== selectedId) options.push({ value: node.id, label: labelOf(node) });
    });
    return options;
  }, [tree, selectedId]);
}

export function ElementConditionFields({
  condition,
  onChange
}: {
  condition: Condition & { kind: "class" | "id" | "attribute" };
  onChange: (next: Condition) => void;
}) {
  const options = useTargetOptions();
  const tree = useEditorStore((s) => s.doc?.tree);
  const missing = Boolean(condition.target && tree && !findNode(tree, condition.target));
  return (
    <>
      <SelectField
        compact
        label="Element"
        options={
          missing && condition.target
            ? [...options, { value: condition.target, label: "Missing element" }]
            : options
        }
        value={condition.target ?? SELF}
        description={
          missing ? "This element is no longer on the page, so it has nothing." : undefined
        }
        onValueChange={(target) =>
          onChange({ ...condition, target: target === SELF ? undefined : target })
        }
      />
      <SelectField
        compact
        label="Operator"
        hideLabel
        options={OP_OPTIONS}
        value={condition.op}
        onValueChange={(op) => onChange({ ...condition, op: op as Condition["op"] })}
      />
      <BoltInput
        label={NAME_LABEL[condition.kind]}
        placeholder={NAME_PLACEHOLDER[condition.kind]}
        value={condition.left}
        onValueChange={(left) => onChange({ ...condition, left })}
      />
      {condition.kind === "attribute" ? (
        <BoltInput
          label="Attribute value"
          placeholder="Any value"
          description="Leave empty to only check that the attribute is there."
          value={condition.right}
          onValueChange={(right) => onChange({ ...condition, right })}
        />
      ) : null}
    </>
  );
}
