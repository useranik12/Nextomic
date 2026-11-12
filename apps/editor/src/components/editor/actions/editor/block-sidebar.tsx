"use client";

import { SwitchField as Switch } from "@/components/ui/toggles";
import {
  BLOCK_PARAM_TYPES,
  STATE_TYPE_LABELS,
  STATE_TYPES,
  type ActionBlock,
  type BlockParam,
  type BlockParamType
} from "@nextomic/schema";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { BoltInput } from "../../right-panel/bolt-input";
import { useFlowDraft } from "./flow-draft";

const PARAM_TYPE_OPTIONS = BLOCK_PARAM_TYPES.map((t) => ({
  value: t,
  label: t === "element" ? "Element" : STATE_TYPE_LABELS[t]
}));
const RETURN_TYPE_OPTIONS = STATE_TYPES.map((t) => ({ value: t, label: STATE_TYPE_LABELS[t] }));

function ParamRow({
  param,
  onChange,
  onRemove
}: {
  param: BlockParam;
  onChange: (p: BlockParam) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border p-2">
      <div className="flex items-end gap-1">
        <FormInput
          compact
          label="Name"
          value={param.name}
          onValueChange={(name) => onChange({ ...param, name })}
          className="flex-1"
        />
        <button
          type="button"
          aria-label={`Remove parameter ${param.name}`}
          onClick={onRemove}
          className="mb-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-default hover:text-danger"
        >
          <Icon name="ph:trash" />
        </button>
      </div>
      <SelectField
        compact
        label="Type"
        value={param.type}
        options={PARAM_TYPE_OPTIONS}
        onValueChange={(type) => onChange({ ...param, type: type as BlockParamType })}
      />
      <div className="flex gap-4">
        <Switch
          size="sm"
          isSelected={param.isList}
          onValueChange={(isList) => onChange({ ...param, isList })}
        >
          <span className="text-sm">List</span>
        </Switch>
        <Switch
          size="sm"
          isSelected={param.required}
          onValueChange={(required) => onChange({ ...param, required })}
        >
          <span className="text-sm">Required</span>
        </Switch>
      </div>
    </li>
  );
}

/** Left column in block mode: the block's name, parameters and return value. */
export function BlockSidebar() {
  const block = useFlowDraft((s) => s.block);
  const setBlock = useFlowDraft((s) => s.setBlock);
  if (!block) return null;
  const set = (patch: Partial<ActionBlock>) => setBlock({ ...block, ...patch });
  const setParam = (id: string, next: BlockParam) =>
    set({ params: block.params.map((p) => (p.id === id ? next : p)) });

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <FormInput
        compact
        label="Block name *"
        value={block.name}
        onValueChange={(name) => set({ name })}
      />
      <FormInput
        compact
        label="Description"
        value={block.description}
        onValueChange={(description) => set({ description })}
      />
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Parameters</h3>
        <p className="text-xs text-muted">Nodes inside read them as {"{{ params.name }}"}.</p>
        <ul className="flex flex-col gap-2">
          {block.params.map((param) => (
            <ParamRow
              key={param.id}
              param={param}
              onChange={(p) => setParam(param.id, p)}
              onRemove={() => set({ params: block.params.filter((p) => p.id !== param.id) })}
            />
          ))}
        </ul>
        <ActionButton
          size="sm"
          tone="ghost"
          startContent={<Icon name="ph:plus" />}
          isDisabled={block.params.length >= 30}
          onPress={() =>
            set({
              params: [
                ...block.params,
                {
                  id: crypto.randomUUID(),
                  name: `param${block.params.length + 1}`,
                  type: "string",
                  isList: false,
                  ref: "",
                  required: false
                }
              ]
            })
          }
        >
          Add parameter
        </ActionButton>
      </section>
      <section className="flex flex-col gap-2">
        <Switch
          size="sm"
          isSelected={Boolean(block.returns)}
          onValueChange={(on) =>
            set({ returns: on ? { type: "string", isList: false, ref: "", value: "" } : undefined })
          }
        >
          <span className="text-sm font-semibold">Returns a value</span>
        </Switch>
        {block.returns ? (
          <>
            <SelectField
              compact
              label="Return type"
              value={block.returns.type}
              options={RETURN_TYPE_OPTIONS}
              onValueChange={(type) =>
                set({ returns: { ...block.returns!, type: type as (typeof STATE_TYPES)[number] } })
              }
            />
            <BoltInput
              label="Return value"
              value={block.returns.value}
              onValueChange={(value) => set({ returns: { ...block.returns!, value } })}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
