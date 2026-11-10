"use client";

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger
} from "@heroui/react";
import { defaultParams, triggerLabel, triggersFor, type TriggerDef } from "@nextomic/schema";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useFlowDraft } from "./flow-draft";

/** Adds a flow for a trigger and opens it. */
function addTrigger(trigger: TriggerDef): void {
  const draft = useFlowDraft.getState();
  draft.setFlows([
    ...draft.flows,
    {
      id: crypto.randomUUID(),
      trigger: trigger.id,
      settings: defaultParams(trigger.fields ?? []),
      nodes: []
    }
  ]);
  draft.selectTrigger(trigger.id);
}

/** Lists the owner's triggers by group; used ones and unavailable ones are disabled. */
export function TriggerPicker({ variant }: { variant: "large" | "icon" }) {
  const target = useFlowDraft((s) => s.target);
  const flows = useFlowDraft((s) => s.flows);
  const used = flows.map((f) => f.trigger);
  if (target?.mode !== "flows") return null;
  const triggers = triggersFor(target.owner, target.elementType);
  const groups = [...new Set(triggers.map((t) => t.group))];
  const disabledKeys = triggers.filter((t) => t.disabled || used.includes(t.id)).map((t) => t.id);
  return (
    <Dropdown placement="bottom" classNames={{ content: "max-h-[60vh] overflow-y-auto" }}>
      <DropdownTrigger>
        {variant === "large" ? (
          <ActionButton size="sm" endContent={<Icon name="ph:caret-down" />}>
            Choose a trigger
          </ActionButton>
        ) : (
          <button
            type="button"
            aria-label="Add a trigger"
            className="flex h-8 w-8 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-foreground"
          >
            <Icon name="ph:plus" />
          </button>
        )}
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Triggers"
        disabledKeys={disabledKeys}
        onAction={(key) => {
          const trigger = triggers.find((t) => t.id === key);
          if (trigger) addTrigger(trigger);
        }}
      >
        {groups.map((group) => (
          <DropdownSection key={group} title={group}>
            {triggers
              .filter((t) => t.group === group)
              .map((t) => (
                <DropdownItem
                  key={t.id}
                  description={
                    t.disabled ?? (used.includes(t.id) ? "Already added." : t.description)
                  }
                >
                  {triggerLabel(t, target.owner)}
                </DropdownItem>
              ))}
          </DropdownSection>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
