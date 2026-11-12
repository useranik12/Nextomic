"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui/menu";
import {
  countEnabledActions,
  getTrigger,
  triggerLabel,
  type FlowOwner,
  type TriggerFlow
} from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";

export type CardCommand = "toggle" | "copy" | "cut" | "delete";

/** One trigger of an element: name, number of enabled actions, and a menu. */
export function FlowCard({
  flow,
  owner,
  busy,
  onOpen,
  onCommand
}: {
  flow: TriggerFlow;
  owner: FlowOwner;
  busy: boolean;
  onOpen: () => void;
  onCommand: (command: CardCommand) => void;
}) {
  const trigger = getTrigger(flow.trigger);
  const label = trigger ? triggerLabel(trigger, owner) : flow.trigger;
  const count = countEnabledActions(flow.nodes);
  return (
    <li
      className={
        "flex items-center gap-1 rounded-xl border border-border bg-surface pr-1 transition-colors duration-300 hover:border-default-400 " +
        (flow.disabled ? "opacity-60" : "")
      }
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="truncate text-base font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted">
          {flow.disabled ? "Disabled · " : ""}
          {count} {count === 1 ? "action" : "actions"}
        </span>
      </button>
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <button
            type="button"
            aria-label={`${label} options`}
            disabled={busy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-default hover:text-foreground disabled:opacity-50"
          >
            <Icon name="ph:dots-three-vertical" width={18} height={18} />
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label={`${label} options`}
          onAction={(key) => onCommand(key as CardCommand)}
        >
          <DropdownItem
            key="toggle"
            id="toggle"
            startContent={
              flow.disabled ? <Icon name="ph:check-circle" /> : <Icon name="ph:prohibit" />
            }
          >
            {flow.disabled ? "Enable action flow" : "Disable action flow"}
          </DropdownItem>
          <DropdownItem key="copy" id="copy" startContent={<Icon name="ph:copy" />}>
            Copy action flow
          </DropdownItem>
          <DropdownItem key="cut" id="cut" startContent={<Icon name="ph:scissors" />}>
            Cut action flow
          </DropdownItem>
          <DropdownItem
            key="delete"
            id="delete"
            className="text-danger"
            color="danger"
            startContent={<Icon name="ph:trash" />}
          >
            Delete action flow
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </li>
  );
}
