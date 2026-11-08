"use client";

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { newRestCall, newRestGroup, type RestCall, type RestConfig } from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { MethodBadge } from "./method-badge";
import type { ApiDataModel } from "./use-api-data";

const ROW =
  "flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left text-small transition-colors duration-300 ";

function CallRow({
  call,
  current,
  nested,
  onPick
}: {
  call: RestCall;
  current: boolean;
  nested: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={current}
        onClick={onPick}
        className={`${ROW}${nested ? "pl-9 " : ""}${current ? "bg-default-100 text-foreground" : "text-default-600 hover:bg-default-50"}`}
      >
        <span className="truncate">{call.name}</span>
        <MethodBadge method={call.method} active={call.active} />
      </button>
    </li>
  );
}

/** "API Calls": groups (collapsible) with their calls, then the ungrouped calls. */
export function ApiList({ model, config }: { model: ApiDataModel; config: RestConfig }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const { selection } = model;
  const isCurrent = (kind: "call" | "group", id: string) =>
    selection?.kind === kind && selection.id === id;
  const pickCall = (call: RestCall) => model.select({ kind: "call", id: call.id });
  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function add(kind: "call" | "group") {
    const id = crypto.randomUUID();
    if (kind === "group")
      model.select({ kind, id, isNew: true }, newRestGroup(id, "New API Group"));
    else model.select({ kind, id, isNew: true }, newRestCall(id, null, "New API Call"));
  }

  const ungrouped = config.calls.filter((c) => c.groupId === null);

  return (
    <nav aria-label="API Calls" className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-medium font-semibold text-foreground">API Calls</h2>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <button
              type="button"
              aria-label="Add API call or group"
              className="flex h-8 w-8 items-center justify-center rounded-full text-default-600 hover:bg-default-100 hover:text-foreground"
            >
              <Icon name="ph:plus-circle" width={20} height={20} />
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Add"
            onAction={(key) => add(key === "group" ? "group" : "call")}
          >
            <DropdownItem key="call">New API Call</DropdownItem>
            <DropdownItem key="group">New API Group</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      {config.groups.length === 0 && config.calls.length === 0 ? (
        <p className="px-2 text-small text-default-500">
          No API calls yet. Press + to add a call or a group.
        </p>
      ) : null}
      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {config.groups.map((group) => {
          const open = !closed.has(group.id);
          const calls = config.calls.filter((c) => c.groupId === group.id);
          return (
            <li key={group.id} className="flex flex-col gap-1">
              <div
                className={`flex items-center rounded-full ${isCurrent("group", group.id) ? "bg-default-100" : "hover:bg-default-50"}`}
              >
                <button
                  type="button"
                  aria-label={open ? `Collapse ${group.name}` : `Expand ${group.name}`}
                  aria-expanded={open}
                  onClick={() => toggle(group.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-default-500 hover:text-foreground"
                >
                  {open ? (
                    <Icon name="ph:caret-down" width={14} height={14} />
                  ) : (
                    <Icon name="ph:caret-right" width={14} height={14} />
                  )}
                </button>
                <button
                  type="button"
                  aria-current={isCurrent("group", group.id)}
                  onClick={() => model.select({ kind: "group", id: group.id })}
                  className="min-w-0 flex-1 truncate py-2 pr-4 text-left text-small text-foreground"
                >
                  {group.name}
                </button>
              </div>
              {open ? (
                <ul className="flex flex-col gap-1" aria-label={`${group.name} calls`}>
                  {calls.map((call) => (
                    <CallRow
                      key={call.id}
                      call={call}
                      nested
                      current={isCurrent("call", call.id)}
                      onPick={() => pickCall(call)}
                    />
                  ))}
                  {calls.length === 0 ? (
                    <li className="pl-9 text-tiny text-default-500">No calls in this group.</li>
                  ) : null}
                </ul>
              ) : null}
            </li>
          );
        })}
        {ungrouped.map((call) => (
          <CallRow
            key={call.id}
            call={call}
            nested={false}
            current={isCurrent("call", call.id)}
            onPick={() => pickCall(call)}
          />
        ))}
      </ul>
    </nav>
  );
}
