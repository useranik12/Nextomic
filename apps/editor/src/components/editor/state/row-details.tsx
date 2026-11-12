"use client";

import { COOKIE_VALUE_LIMIT, type AppStateVariable } from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { Icon } from "@/lib/icons/Icon";
import { compactFieldClass } from "../right-panel/setting-row";
import type { StateRowVariable } from "./state-row";
import type { UsagePlace } from "./use-state-usage";

function PersistOptions({
  variable,
  onChange
}: {
  variable: AppStateVariable;
  onChange: (next: AppStateVariable) => void;
}) {
  const tooBig =
    variable.storage === "cookie" && new Blob([variable.defaultValue]).size > COOKIE_VALUE_LIMIT;
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        compact
        label="Storage"
        value={variable.storage}
        options={[
          { value: "local", label: "Local storage" },
          { value: "cookie", label: "Cookie" }
        ]}
        onValueChange={(storage) =>
          onChange({ ...variable, storage: storage === "cookie" ? "cookie" : "local" })
        }
        className="max-w-60"
      />
      {variable.storage === "cookie" ? (
        <p className={`text-xs ${tooBig ? "text-danger" : "text-muted"}`}>
          A cookie is sent with every request and holds about 4 KB.
          {tooBig ? " This default value is already larger than that." : ""} Use it only for small
          values the server needs while rendering, such as a language choice.
        </p>
      ) : null}
      <SwitchRow
        label="Keep after logout"
        tip="Persisted values are cleared when the visitor logs out. On keeps this one, for example a cookie consent flag or a language choice."
        selected={variable.keepAfterLogout}
        onChange={(keepAfterLogout) => onChange({ ...variable, keepAfterLogout })}
      />
    </div>
  );
}

/** The expanded part of a row: description, persistence and where it is used. */
export function RowDetails({
  row,
  places,
  onChange
}: {
  row: StateRowVariable;
  places: UsagePlace[];
  onChange: (next: StateRowVariable["variable"]) => void;
}) {
  const v = row.variable;
  return (
    <div className="mb-3 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/40 p-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        {row.kind === "app" ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-body">Description</span>
            <input
              value={v.description}
              maxLength={300}
              placeholder="What this variable is for"
              onChange={(e) => onChange({ ...v, description: e.target.value })}
              className={compactFieldClass}
            />
          </label>
        ) : null}
        {row.kind === "app" && row.variable.persist ? (
          <PersistOptions variable={row.variable} onChange={onChange} />
        ) : row.kind === "app" ? (
          <p className="text-xs text-muted">
            Not persisted: the value starts from the default on every visit.
          </p>
        ) : (
          <p className="text-xs text-muted">
            Constants are fixed. Actions can read them but never change them.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-body">
          Where used ({places.reduce((n, p) => n + p.count, 0)})
        </span>
        {places.length === 0 ? (
          <p className="text-xs text-muted">Not used on any page or template yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {places.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Icon
                  name={p.kind === "page" ? "ph:file-text" : "ph:layout"}
                  width={14}
                  height={14}
                  className="text-muted"
                />
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="text-xs text-muted">×{p.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
