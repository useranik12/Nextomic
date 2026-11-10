"use client";

import {
  countConditions,
  loopItemName,
  loopNameCode,
  MAX_LOOP_ITERATIONS,
  type ConditionGroup,
  type FlowNode
} from "@nextomic/schema";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { ConditionGroupEditor } from "../../conditions/condition-group-editor";
import { BoltInput } from "../../right-panel/bolt-input";

type Of<K extends FlowNode["kind"]> = Extract<FlowNode, { kind: K }>;

const emptyGroup = (): ConditionGroup => ({ id: crypto.randomUUID(), match: "all", items: [] });

function GroupEditor({
  group,
  onChange
}: {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
}) {
  return (
    <ConditionGroupEditor
      group={group}
      depth={1}
      total={countConditions(group)}
      onChange={onChange}
    />
  );
}

function ConditionSettings({
  node,
  update
}: {
  node: Of<"condition">;
  update: (n: FlowNode) => void;
}) {
  const setBranch = (id: string, group: ConditionGroup) =>
    update({ ...node, branches: node.branches.map((b) => (b.id === id ? { ...b, group } : b)) });
  return (
    <div className="flex flex-col gap-4">
      {node.branches.map((branch, i) => (
        <section
          key={branch.id}
          className="flex flex-col gap-2 rounded-medium border border-divider p-2"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-small font-semibold">{i === 0 ? "If" : "Else if"}</h4>
            {i > 0 ? (
              <button
                type="button"
                aria-label="Remove this branch"
                onClick={() =>
                  update({ ...node, branches: node.branches.filter((b) => b.id !== branch.id) })
                }
                className="flex h-7 w-7 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-danger"
              >
                <Icon name="ph:trash" />
              </button>
            ) : null}
          </div>
          <GroupEditor group={branch.group} onChange={(g) => setBranch(branch.id, g)} />
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          size="sm"
          tone="ghost"
          startContent={<Icon name="ph:plus" />}
          onPress={() =>
            update({
              ...node,
              branches: [
                ...node.branches,
                { id: crypto.randomUUID(), group: emptyGroup(), nodes: [] }
              ]
            })
          }
        >
          Add else if
        </ActionButton>
        <ActionButton
          size="sm"
          tone={node.else ? "danger-ghost" : "ghost"}
          onPress={() => update({ ...node, else: node.else ? undefined : [] })}
        >
          {node.else ? "Remove else" : "Add else"}
        </ActionButton>
      </div>
    </div>
  );
}

/** A new list renames the generated item name, and tags inside the loop follow it. */
function withList(node: Of<"loop">, list: string): Of<"loop"> {
  const itemName = loopItemName(list, loopNameCode(node.itemName));
  // Only generated names are renamed in tags: an old name like "item" is too common to replace.
  const nodes = loopNameCode(node.itemName)
    ? (JSON.parse(JSON.stringify(node.nodes).split(node.itemName).join(itemName)) as FlowNode[])
    : node.nodes;
  return { ...node, list, itemName, nodes };
}

function LoopSettings({ node, update }: { node: Of<"loop">; update: (n: FlowNode) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        compact
        label="Repeat"
        value={node.mode}
        options={[
          { value: "forEach", label: "For each item of a list" },
          { value: "while", label: "While a condition holds" }
        ]}
        onValueChange={(mode) => update({ ...node, mode: mode === "while" ? "while" : "forEach" })}
      />
      {node.mode === "forEach" ? (
        <>
          <BoltInput
            label="List *"
            value={node.list}
            onValueChange={(list) => update(withList(node, list))}
          />
          <FormInput
            compact
            isReadOnly
            label="Item name"
            value={node.itemName}
            description={`Nodes inside read {{ ${node.itemName}.item }} and {{ ${node.itemName}.index }}. Set from the list.`}
          />
          <BoltInput
            label="Start index"
            value={node.start}
            placeholder="0"
            inputMode="numeric"
            onValueChange={(start) => update({ ...node, start })}
          />
          <BoltInput
            label="End index"
            value={node.end}
            placeholder="Last item"
            inputMode="numeric"
            onValueChange={(end) => update({ ...node, end })}
          />
          <BoltInput
            label="Step size"
            value={node.step}
            placeholder="1"
            inputMode="numeric"
            onValueChange={(step) => update({ ...node, step })}
          />
        </>
      ) : (
        <GroupEditor
          group={node.condition ?? emptyGroup()}
          onChange={(condition) => update({ ...node, condition })}
        />
      )}
      <FormInput
        compact
        label="Stop after (rounds)"
        inputMode="numeric"
        value={String(node.maxIterations)}
        onValueChange={(v) => {
          const n = Math.round(Number(v));
          if (Number.isFinite(n))
            update({ ...node, maxIterations: Math.min(Math.max(n, 1), MAX_LOOP_ITERATIONS) });
        }}
      />
    </div>
  );
}

function ParallelSettings({
  node,
  update
}: {
  node: Of<"parallel">;
  update: (n: FlowNode) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-small text-default-500">
        Lanes run at the same time; the next node starts when every lane has finished.
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          size="sm"
          tone="ghost"
          startContent={<Icon name="ph:plus" />}
          isDisabled={node.lanes.length >= 10}
          onPress={() =>
            update({ ...node, lanes: [...node.lanes, { id: crypto.randomUUID(), nodes: [] }] })
          }
        >
          Add lane
        </ActionButton>
        <ActionButton
          size="sm"
          tone="danger-ghost"
          isDisabled={node.lanes.length <= 1}
          onPress={() => update({ ...node, lanes: node.lanes.slice(0, -1) })}
        >
          Remove last lane
        </ActionButton>
      </div>
    </div>
  );
}

/** Settings of control nodes; null for kinds without settings. */
export function ContainerSettings({
  node,
  update
}: {
  node: FlowNode;
  update: (n: FlowNode) => void;
}) {
  switch (node.kind) {
    case "condition":
      return <ConditionSettings node={node} update={update} />;
    case "loop":
      return <LoopSettings node={node} update={update} />;
    case "parallel":
      return <ParallelSettings node={node} update={update} />;
    case "tryCatch":
      return (
        <FormInput
          compact
          label="Error name"
          value={node.errorName}
          onValueChange={(errorName) => update({ ...node, errorName })}
          description="Catch nodes read the error ({ code, message }) by this name."
        />
      );
    case "break":
      return <p className="text-small text-default-500">Leaves the loop around this node.</p>;
    case "continue":
      return <p className="text-small text-default-500">Skips to the next round of the loop.</p>;
    default:
      return null;
  }
}
