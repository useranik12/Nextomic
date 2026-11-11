"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui-v2/react";
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
        "flex items-center gap-1 rounded-medium border border-divider bg-content1 pr-1 transition-colors duration-300 hover:border-default-400 " +
        (flow.disabled ? "opacity-60" : "")
      }
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-medium px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="truncate text-medium font-semibold text-foreground">{label}</span>
        <span className="text-tiny text-default-500">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-foreground disabled:opacity-50"
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
            startContent={
              flow.disabled ? <Icon name="ph:check-circle" /> : <Icon name="ph:prohibit" />
            }
          >
            {flow.disabled ? "Enable action flow" : "Disable action flow"}
          </DropdownItem>
          <DropdownItem key="copy" startContent={<Icon name="ph:copy" />}>
            Copy action flow
          </DropdownItem>
          <DropdownItem key="cut" startContent={<Icon name="ph:scissors" />}>
            Cut action flow
          </DropdownItem>
          <DropdownItem
            key="delete"
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
