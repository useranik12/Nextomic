"use client";

import { Switch } from "@heroui/react";
import { REST_METHODS, type RestCall, type RestGroup, type RestMethod } from "@nextomic/schema";
import { FormInput, SelectField } from "@/components/ui/controls";
import { DynamicBolt } from "../right-panel/dynamic-bolt";

const NO_GROUP = "none";

/** Active, name, method, group, then the group's base URL with the endpoint, or a full URL. */
export function CallConnection({
  call,
  groups,
  onChange
}: {
  call: RestCall;
  groups: RestGroup[];
  onChange: (next: RestCall) => void;
}) {
  const group = groups.find((g) => g.id === call.groupId) ?? null;
  const urlLabel = group ? "Endpoint" : "API URL";

  return (
    <section
      aria-label="Connection"
      className="flex flex-col gap-4 rounded-large border border-default-200 p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-small font-medium text-foreground">Connection</h2>
        <Switch
          size="sm"
          isSelected={call.active}
          onValueChange={(active) => onChange({ ...call, active })}
        >
          <span className="text-small">Active</span>
        </Switch>
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <FormInput
          compact
          label="API Call Name"
          value={call.name}
          onValueChange={(name) => onChange({ ...call, name })}
        />
        <SelectField
          compact
          label="Group"
          value={call.groupId ?? NO_GROUP}
          options={[
            { value: NO_GROUP, label: "No group" },
            ...groups.map((g) => ({ value: g.id, label: g.name }))
          ]}
          onValueChange={(v) => onChange({ ...call, groupId: v === NO_GROUP ? null : v })}
        />
      </div>
      <div className="grid items-end gap-4 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.2fr)]">
        <SelectField
          compact
          label="Method"
          value={call.method}
          options={REST_METHODS.map((m) => ({ value: m, label: m }))}
          onValueChange={(v) => onChange({ ...call, method: v as RestMethod })}
        />
        {group ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-tiny font-medium text-default-600">Group Base URL</span>
            <span className="truncate py-1.5 text-small text-default-600" title={group.baseUrl}>
              {group.baseUrl || "No base URL set on the group."}
            </span>
          </div>
        ) : null}
        <div className={`flex items-end gap-1.5 ${group ? "" : "md:col-span-2"}`}>
          <FormInput
            compact
            label={urlLabel}
            placeholder={group ? "/users/[id]" : "https://api.example.com/users/[id]"}
            value={call.url}
            onValueChange={(url) => onChange({ ...call, url })}
            className="font-mono"
          />
          <div className="pb-1">
            <DynamicBolt
              label={urlLabel}
              onInsert={(t) => onChange({ ...call, url: `${call.url}{{${t}}}` })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
