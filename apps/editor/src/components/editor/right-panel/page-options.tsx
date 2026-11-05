"use client";

import { Checkbox } from "@heroui/react";
import { ROUTE_PATTERN, pageVariableTypeSchema, type PageSettings } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { compactFieldClass } from "./setting-row";

const TYPES = pageVariableTypeSchema.options;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Params = PageSettings["params"];
type StateVars = PageSettings["state"];

/** Name input that only commits a valid, unique identifier; shows why otherwise. */
function NameField({
  value,
  taken,
  label,
  onCommit
}: {
  value: string;
  taken: string[];
  label: string;
  onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const problem = !IDENTIFIER.test(draft)
    ? "Use letters, digits and _, not starting with a digit."
    : taken.includes(draft)
      ? "That name is already used."
      : null;
  return (
    <div className="min-w-0 flex-1">
      <input
        aria-label={label}
        aria-invalid={Boolean(problem)}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (IDENTIFIER.test(e.target.value) && !taken.includes(e.target.value))
            onCommit(e.target.value);
        }}
        onBlur={() => problem && setDraft(value)}
        className={compactFieldClass + (problem ? " !border-danger" : "")}
      />
      {problem ? (
        <p role="alert" className="mt-0.5 text-tiny text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

function uniqueName(prefix: string, used: string[]): string {
  let n = used.length + 1;
  while (used.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

function TypeSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: (typeof TYPES)[number]) => void;
}) {
  return (
    <SelectField
      compact
      hideLabel
      label={label}
      value={value}
      options={TYPES.map((t) => ({ value: t, label: t }))}
      onValueChange={(next) => onChange(next as (typeof TYPES)[number])}
      className="w-28 shrink-0"
    />
  );
}

function PageParameters() {
  const params = useEditorStore((s) => s.doc?.settings.params ?? []);
  const update = useEditorStore((s) => s.updatePageSettings);
  const [editing, setEditing] = useState(false);
  const set = (next: Params) => update({ params: next });
  return (
    <section aria-label="Page parameters" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-small text-default-600">Page Parameters</h3>
        <button
          type="button"
          aria-label={editing ? "Done editing parameters" : "Edit parameters"}
          onClick={() => setEditing((v) => !v)}
          className="rounded p-1 text-default-600 hover:text-foreground"
        >
          {editing ? (
            <Icon name="ph:check" width={16} height={16} />
          ) : (
            <Icon name="ph:pencil-simple" width={16} height={16} />
          )}
        </button>
      </div>
      {params.length === 0 && !editing ? (
        <p className="text-tiny text-default-500">No parameters.</p>
      ) : null}
      {params.map((param, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col gap-1.5 rounded-large border border-default-200 p-2"
        >
          {editing ? (
            <>
              <div className="flex items-start gap-1">
                <NameField
                  label="Parameter name"
                  value={param.name}
                  taken={params.filter((_, i) => i !== index).map((p) => p.name)}
                  onCommit={(name) => set(params.map((p, i) => (i === index ? { ...p, name } : p)))}
                />
                <button
                  type="button"
                  aria-label={`Remove ${param.name}`}
                  onClick={() => set(params.filter((_, i) => i !== index))}
                  className="mt-1.5 shrink-0 rounded p-0.5 text-default-500 hover:text-danger"
                >
                  <Icon name="ph:trash" width={14} height={14} />
                </button>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <TypeSelect
                  label="Parameter type"
                  value={param.type}
                  onChange={(type) => set(params.map((p, i) => (i === index ? { ...p, type } : p)))}
                />
                <input
                  aria-label={`Value for ${param.name}`}
                  placeholder="Value"
                  value={param.defaultValue}
                  onChange={(e) =>
                    set(
                      params.map((p, i) =>
                        i === index ? { ...p, defaultValue: e.target.value } : p
                      )
                    )
                  }
                  className={compactFieldClass + " min-w-0 flex-1"}
                />
              </div>
            </>
          ) : (
            <p className="min-w-0 truncate text-small text-foreground">
              {param.name}
              <span className="text-tiny text-default-500"> {param.type}</span>
              {param.defaultValue ? (
                <span className="text-tiny text-default-500"> = {param.defaultValue}</span>
              ) : null}
            </p>
          )}
        </div>
      ))}
      {editing ? (
        <ActionButton
          size="sm"
          tone="ghost"
          onPress={() =>
            set([
              ...params,
              {
                name: uniqueName(
                  "param",
                  params.map((p) => p.name)
                ),
                type: "string",
                required: false,
                defaultValue: ""
              }
            ])
          }
        >
          Add parameter
        </ActionButton>
      ) : null}
    </section>
  );
}

function RouteSettings() {
  const route = useEditorStore((s) => s.doc?.route ?? "/");
  const requiresAuth = useEditorStore((s) => s.doc?.settings.requiresAuth ?? false);
  const updateMeta = useEditorStore((s) => s.updatePageMeta);
  const updateSettings = useEditorStore((s) => s.updatePageSettings);
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState(route.replace(/^\//, ""));
  const valid = ROUTE_PATTERN.test(`/${draft}`);
  return (
    <section aria-label="Route settings" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-small text-default-600">Route Settings</h3>
        <button
          type="button"
          aria-label={open ? "Collapse route settings" : "Expand route settings"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded p-1 text-default-600 hover:text-foreground"
        >
          {open ? (
            <Icon name="ph:minus-circle" width={16} height={16} />
          ) : (
            <Icon name="ph:plus" width={16} height={16} />
          )}
        </button>
      </div>
      {open ? (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="route-input" className="text-tiny text-default-600">
              Route/
            </label>
            <input
              id="route-input"
              value={draft}
              aria-invalid={!valid}
              onChange={(e) => {
                setDraft(e.target.value);
                if (ROUTE_PATTERN.test(`/${e.target.value}`))
                  updateMeta({ route: `/${e.target.value}` });
              }}
              onBlur={() => !valid && setDraft(route.replace(/^\//, ""))}
              className={compactFieldClass + (valid ? "" : " !border-danger")}
            />
          </div>
          {valid ? null : (
            <p role="alert" className="text-tiny text-danger">
              Use letters, digits, - _ . and / between segments.
            </p>
          )}
          <Checkbox
            size="sm"
            isSelected={requiresAuth}
            onValueChange={(v) => updateSettings({ requiresAuth: v })}
          >
            <span className="text-small">Requires Authentication</span>
          </Checkbox>
        </>
      ) : null}
    </section>
  );
}

function StateVariables() {
  const vars = useEditorStore((s) => s.doc?.settings.state ?? []);
  const update = useEditorStore((s) => s.updatePageSettings);
  const set = (next: StateVars) => update({ state: next });
  return (
    <section aria-label="Page state variables" className="flex flex-col gap-2">
      <h3 className="text-small text-default-600">Page State Variables</h3>
      {vars.length === 0 ? (
        <p className="text-tiny text-default-500">
          No variables yet. They reset when the page is left.
        </p>
      ) : null}
      {vars.map((v, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 rounded-large border border-default-200 p-2"
        >
          <div className="flex items-start gap-1">
            <NameField
              label="Variable name"
              value={v.name}
              taken={vars.filter((_, i) => i !== index).map((x) => x.name)}
              onCommit={(name) => set(vars.map((x, i) => (i === index ? { ...x, name } : x)))}
            />
            <button
              type="button"
              aria-label={`Remove ${v.name}`}
              onClick={() => set(vars.filter((_, i) => i !== index))}
              className="mt-1.5 shrink-0 rounded p-0.5 text-default-500 hover:text-danger"
            >
              <Icon name="ph:trash" width={14} height={14} />
            </button>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <TypeSelect
              label="Variable type"
              value={v.type}
              onChange={(type) => set(vars.map((x, i) => (i === index ? { ...x, type } : x)))}
            />
            <Checkbox
              size="sm"
              isSelected={v.isList}
              onValueChange={(isList) =>
                set(vars.map((x, i) => (i === index ? { ...x, isList } : x)))
              }
            >
              <span className="text-tiny">List</span>
            </Checkbox>
            <input
              aria-label={`Default value for ${v.name}`}
              placeholder="Default value"
              value={typeof v.defaultValue === "string" ? v.defaultValue : ""}
              onChange={(e) =>
                set(vars.map((x, i) => (i === index ? { ...x, defaultValue: e.target.value } : x)))
              }
              className={compactFieldClass + " w-full"}
            />
          </div>
        </div>
      ))}
      <ActionButton
        size="sm"
        tone="ghost"
        onPress={() =>
          set([
            ...vars,
            {
              name: uniqueName(
                "variable",
                vars.map((x) => x.name)
              ),
              type: "string",
              isList: false
            }
          ])
        }
      >
        Add Variable
      </ActionButton>
    </section>
  );
}

/** Right panel when nothing is selected (docs/ui-reference.md 4.3). */
export function PageOptions() {
  const pageId = useEditorStore((s) => s.page?.id);
  // Remount per page so local drafts (route, names) reset when the page changes.
  return (
    <div key={pageId} className="flex flex-col gap-6 overflow-y-auto p-4">
      <PageParameters />
      <RouteSettings />
      <StateVariables />
    </div>
  );
}
