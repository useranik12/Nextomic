"use client";

import { Checkbox } from "@heroui/react";
import { PARAM_TYPES, ROUTE_PATTERN, STATE_TYPE_LABELS, type PageSettings } from "@nextomic/schema";
import { TypePicker } from "../data-types/type-picker";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { DraftScope } from "../draft-scope";
import { useEditorStore } from "../store/editor-store";
import { DynamicBolt } from "./dynamic-bolt";
import { MarkingGroup } from "./marking-group";
import { compactFieldClass } from "./setting-row";

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
  onChange: (v: (typeof PARAM_TYPES)[number]) => void;
}) {
  return (
    <SelectField
      compact
      hideLabel
      label={label}
      value={value}
      options={PARAM_TYPES.map((t) => ({ value: t, label: STATE_TYPE_LABELS[t] }))}
      onValueChange={(next) => onChange(next as (typeof PARAM_TYPES)[number])}
      className="w-28 shrink-0"
    />
  );
}

/** Header of a group edited as a draft: pencil to edit, X to discard, check to save. */
function DraftHeader({
  title,
  editing,
  dirty,
  onEdit,
  onCancel,
  onSave
}: {
  title: string;
  editing: boolean;
  dirty: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const icon = "rounded-full p-1 text-default-600 transition-colors duration-300 ";
  return (
    <div className="flex items-center justify-between">
      <h3 className="flex items-center gap-1.5 text-small text-default-600">
        {title}
        {dirty ? (
          <span
            role="img"
            aria-label="Unsaved changes"
            className="h-1.5 w-1.5 rounded-full bg-warning"
          />
        ) : null}
      </h3>
      {editing ? (
        <div className="flex items-center">
          <button
            type="button"
            aria-label={`Discard changes to ${title}`}
            onClick={onCancel}
            className={icon + "hover:text-danger"}
          >
            <Icon name="ph:x" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label={`Save ${title}`}
            onClick={onSave}
            className={icon + "hover:text-success"}
          >
            <Icon name="ph:check" width={16} height={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Edit ${title}`}
          onClick={onEdit}
          className={icon + "hover:text-foreground"}
        >
          <Icon name="ph:pencil-simple" width={16} height={16} />
        </button>
      )}
    </div>
  );
}

/** A text field with the dynamic bolt inside on the right. */
function BoltInput({
  label,
  placeholder,
  value,
  exclude,
  onChange,
  className
}: {
  label: string;
  placeholder: string;
  value: string;
  exclude: ("params" | "state")[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={"relative min-w-0 " + (className ?? "")}>
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={compactFieldClass + " pr-9"}
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
        <DynamicBolt
          label={label}
          exclude={exclude}
          onInsert={(token) => onChange(`${value}{{${token}}}`)}
        />
      </div>
    </div>
  );
}

function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
      className="mt-1.5 shrink-0 rounded p-0.5 text-default-500 hover:text-danger"
    >
      <Icon name="ph:trash" width={14} height={14} />
    </button>
  );
}

function PageParameters() {
  const saved = useEditorStore((s) => s.doc?.settings.params ?? []);
  const draft = useEditorStore((s) => s.pageDrafts.params);
  const setDraft = useEditorStore((s) => s.setPageDraft);
  const update = useEditorStore((s) => s.updatePageSettings);
  const editing = draft !== null;
  const params = draft ?? saved;
  const set = (next: Params) => setDraft("params", next);
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(saved);
  const save = () => {
    if (draft) update({ params: draft });
    setDraft("params", null);
    return true;
  };
  return (
    <DraftScope
      label="Page Parameters"
      dirty={dirty}
      onSave={save}
      onDiscard={() => setDraft("params", null)}
    >
      <section aria-label="Page parameters" className="flex flex-col gap-2">
        <DraftHeader
          title="Page Parameters"
          editing={editing}
          dirty={dirty}
          onEdit={() => setDraft("params", structuredClone(saved))}
          onCancel={() => setDraft("params", null)}
          onSave={save}
        />
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
                    onCommit={(name) =>
                      set(params.map((p, i) => (i === index ? { ...p, name } : p)))
                    }
                  />
                  <RemoveButton
                    name={param.name}
                    onRemove={() => set(params.filter((_, i) => i !== index))}
                  />
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <TypeSelect
                    label="Parameter type"
                    value={param.type}
                    onChange={(type) =>
                      set(params.map((p, i) => (i === index ? { ...p, type } : p)))
                    }
                  />
                  <BoltInput
                    label={`Value for ${param.name}`}
                    placeholder="Value"
                    value={param.defaultValue}
                    exclude={["params", "state"]}
                    className="flex-1"
                    onChange={(defaultValue) =>
                      set(params.map((p, i) => (i === index ? { ...p, defaultValue } : p)))
                    }
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
    </DraftScope>
  );
}

function RouteSettings() {
  const route = useEditorStore((s) => s.doc?.route ?? "/");
  const requiresAuth = useEditorStore((s) => s.doc?.settings.requiresAuth ?? false);
  const appAuth = useEditorStore((s) => s.project.appAuth);
  const pageId = useEditorStore((s) => s.page?.id ?? "");
  const isLoginPage = appAuth.enabled && pageId !== "" && pageId === appAuth.entryPageId;
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
            isSelected={requiresAuth && !isLoginPage}
            isDisabled={!appAuth.enabled || isLoginPage}
            onValueChange={(v) => updateSettings({ requiresAuth: v })}
          >
            <span className="text-small">Requires Authentication</span>
          </Checkbox>
          {!appAuth.enabled ? (
            <p className="text-tiny text-default-500">
              Turn on authentication in App Settings to use this.
            </p>
          ) : isLoginPage ? (
            <p className="text-tiny text-default-500">
              This is the login page, so it never requires sign-in.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function StateVariables() {
  const saved = useEditorStore((s) => s.doc?.settings.state ?? []);
  const draft = useEditorStore((s) => s.pageDrafts.state);
  const setDraft = useEditorStore((s) => s.setPageDraft);
  const update = useEditorStore((s) => s.updatePageSettings);
  const editing = draft !== null;
  const vars = draft ?? saved;
  const set = (next: StateVars) => setDraft("state", next);
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(saved);
  const save = () => {
    if (draft) update({ state: draft });
    setDraft("state", null);
    return true;
  };
  return (
    <DraftScope
      label="Page State Variables"
      dirty={dirty}
      onSave={save}
      onDiscard={() => setDraft("state", null)}
    >
      <section aria-label="Page state variables" className="flex flex-col gap-2">
        <DraftHeader
          title="Page State Variables"
          editing={editing}
          dirty={dirty}
          onEdit={() => setDraft("state", structuredClone(saved))}
          onCancel={() => setDraft("state", null)}
          onSave={save}
        />
        {vars.length === 0 && !editing ? (
          <p className="text-tiny text-default-500">
            No variables yet. They reset when the page is left.
          </p>
        ) : null}
        {vars.map((v, index) => (
          <div
            key={index}
            className="flex flex-col gap-1.5 rounded-large border border-default-200 p-2"
          >
            {editing ? (
              <>
                <div className="flex items-start gap-1">
                  <NameField
                    label="Variable name"
                    value={v.name}
                    taken={vars.filter((_, i) => i !== index).map((x) => x.name)}
                    onCommit={(name) => set(vars.map((x, i) => (i === index ? { ...x, name } : x)))}
                  />
                  <RemoveButton
                    name={v.name}
                    onRemove={() => set(vars.filter((_, i) => i !== index))}
                  />
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <div className="w-full">
                    <TypePicker
                      label="Variable type"
                      spec={v}
                      onChange={(next) =>
                        set(vars.map((x, i) => (i === index ? { ...x, ...next } : x)))
                      }
                    />
                  </div>
                  <Checkbox
                    size="sm"
                    isSelected={v.isList}
                    onValueChange={(isList) =>
                      set(vars.map((x, i) => (i === index ? { ...x, isList } : x)))
                    }
                  >
                    <span className="text-tiny">List</span>
                  </Checkbox>
                  <BoltInput
                    label={`Default value for ${v.name}`}
                    placeholder="Default value"
                    value={typeof v.defaultValue === "string" ? v.defaultValue : ""}
                    exclude={["state"]}
                    className="w-full"
                    onChange={(defaultValue) =>
                      set(vars.map((x, i) => (i === index ? { ...x, defaultValue } : x)))
                    }
                  />
                </div>
              </>
            ) : (
              <p className="min-w-0 truncate text-small text-foreground">
                {v.name}
                <span className="text-tiny text-default-500">
                  {" "}
                  {v.type}
                  {v.isList ? "[]" : ""}
                </span>
                {typeof v.defaultValue === "string" && v.defaultValue ? (
                  <span className="text-tiny text-default-500"> = {v.defaultValue}</span>
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
                ...vars,
                {
                  name: uniqueName(
                    "variable",
                    vars.map((x) => x.name)
                  ),
                  type: "string",
                  isList: false,
                  ref: ""
                }
              ])
            }
          >
            Add Variable
          </ActionButton>
        ) : null}
      </section>
    </DraftScope>
  );
}

/** Right panel when nothing is selected (docs/ui-reference.md 4.3). */
function PageMarking() {
  const categoryIds = useEditorStore((s) => s.doc?.settings.categoryIds ?? []);
  const tagIds = useEditorStore((s) => s.doc?.settings.tagIds ?? []);
  const updateSettings = useEditorStore((s) => s.updatePageSettings);
  return (
    <MarkingGroup
      scope="page"
      categoryIds={categoryIds}
      tagIds={tagIds}
      onChange={(change) => updateSettings(change)}
    />
  );
}

export function PageOptions() {
  const pageId = useEditorStore((s) => s.page?.id);
  // Remount per page so local drafts (route, names) reset when the page changes.
  return (
    <div key={pageId} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      <PageParameters />
      <RouteSettings />
      <PageMarking />
      <StateVariables />
    </div>
  );
}
