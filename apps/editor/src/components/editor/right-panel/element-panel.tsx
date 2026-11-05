"use client";

import { getElementDefinition, type ControlDef } from "@nextomic/renderer";
import {
  dynamicTextOf,
  findNode,
  getStyle,
  parseDynamicText,
  type ElementNode,
  type PseudoState
} from "@nextomic/schema";
import { useId, useMemo, useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { DESIGN_GROUPS, type DesignProperty } from "./design-groups";
import { DesignIcon } from "./design-icons";
import { DynamicBolt } from "./dynamic-bolt";
import { IdentityField } from "./identity-field";
import { SettingRow, compactFieldClass } from "./setting-row";

const STATES: PseudoState[] = ["default", "hover", "focus", "active", "disabled"];

type Tab = "element" | "design" | "action";

// HeroUI Select keys cannot be empty, so "no value set" has its own key.
const DEFAULT_OPTION = "__default";

function ControlField({ node, control }: { node: ElementNode; control: ControlDef }) {
  const id = useId();
  const setProp = useEditorStore((s) => s.setElementProp);
  const setTag = useEditorStore((s) => s.setElementTag);
  const isTag = control.key === "htmlTag";
  const value = isTag ? (node.htmlTag ?? "") : dynamicTextOf(node.props[control.key]);
  const onChange = (next: string) =>
    isTag ? setTag(node.id, next) : setProp(node.id, control.key, parseDynamicText(next));
  const insertToken = (token: string) => onChange(`${value}{{${token}}}`);

  if (control.kind === "select") {
    return (
      <SelectField
        compact
        label={control.label}
        value={value}
        options={control.options ?? []}
        onValueChange={onChange}
      />
    );
  }

  return (
    <SettingRow label={control.label} htmlFor={id}>
      <div className="relative">
        {control.kind === "textarea" ? (
          <textarea
            id={id}
            value={value}
            rows={3}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-large border-2 border-default-200 bg-transparent py-2 pl-3 pr-9 text-small text-foreground outline-none transition-colors hover:border-default-400 focus:border-default-800"
          />
        ) : (
          <input
            id={id}
            value={value}
            placeholder={control.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={compactFieldClass + " pr-9"}
          />
        )}
        {isTag ? null : (
          <div
            className={
              "absolute right-1.5 " +
              (control.kind === "textarea" ? "top-2" : "top-1/2 -translate-y-1/2")
            }
          >
            <DynamicBolt label={control.label} onInsert={insertToken} />
          </div>
        )}
      </div>
    </SettingRow>
  );
}

function DesignField({ node, property }: { node: ElementNode; property: DesignProperty }) {
  const id = useId();
  const bp = useEditorStore((s) => s.activeBreakpointId);
  const state = useEditorStore((s) => s.activeState);
  const setStyle = useEditorStore((s) => s.setElementStyle);
  const own = getStyle(node, bp, state, property.property);
  // Dimmed hint of the value inherited from the base breakpoint.
  const inherited = bp === "base" ? undefined : getStyle(node, "base", state, property.property);
  const changed = own !== undefined;

  return (
    <SettingRow
      label={property.label}
      htmlFor={id}
      changed={changed}
      onReset={() => setStyle(node.id, property.property, null)}
    >
      {property.options && property.icons ? (
        <div role="group" aria-label={property.label} className="flex flex-wrap gap-1">
          {property.options.map((o) => (
            <button
              key={o}
              type="button"
              title={o}
              aria-label={o}
              aria-pressed={own === o}
              onClick={() => setStyle(node.id, property.property, own === o ? null : o)}
              className={
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-300 " +
                (own === o
                  ? "bg-primary text-primary-foreground"
                  : "bg-default-100 text-default-600 hover:bg-default-200")
              }
            >
              <DesignIcon id={property.icons?.[o] ?? ""} />
            </button>
          ))}
        </div>
      ) : property.options ? (
        <SelectField
          compact
          hideLabel
          label={property.label}
          value={own ?? DEFAULT_OPTION}
          options={[
            { value: DEFAULT_OPTION, label: inherited ? `${inherited} (inherited)` : "Default" },
            ...property.options.map((o) => ({ value: o, label: o }))
          ]}
          onValueChange={(next) =>
            setStyle(node.id, property.property, next === DEFAULT_OPTION ? null : next)
          }
        />
      ) : (
        <div className="relative">
          <input
            id={id}
            value={own ?? ""}
            placeholder={inherited ?? property.placeholder}
            onChange={(e) =>
              setStyle(
                node.id,
                property.property,
                e.target.value.trim() === "" ? null : e.target.value
              )
            }
            className={compactFieldClass + " pr-9"}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <DynamicBolt
              label={property.label}
              onInsert={() => undefined}
              disabledReason="Dynamic style values arrive with the dynamic data phase."
            />
          </div>
        </div>
      )}
    </SettingRow>
  );
}

export function ElementPanel({ node }: { node: ElementNode }) {
  const definition = getElementDefinition(node.type);
  const [tab, setTab] = useState<Tab>("element");
  const [query, setQuery] = useState("");
  const bp = useEditorStore((s) => s.activeBreakpointId);
  const state = useEditorStore((s) => s.activeState);
  const setState = useEditorStore((s) => s.setActiveState);
  const rename = useEditorStore((s) => s.renameElement);
  const duplicate = useEditorStore((s) => s.duplicateElement);
  const copy = useEditorStore((s) => s.copyElement);
  const paste = useEditorStore((s) => s.pasteElement);
  const remove = useEditorStore((s) => s.removeElement);
  const hasClipboard = useEditorStore((s) => s.clipboard !== null);

  const designDot = useMemo(
    () => Object.values(node.styles.breakpoints[bp] ?? {}).some((d) => Object.keys(d).length > 0),
    [node.styles, bp]
  );
  const q = query.trim().toLowerCase();
  const controls = (definition?.controls ?? []).filter(
    (c) => !q || c.label.toLowerCase().includes(q)
  );
  const groups = DESIGN_GROUPS.map((g) => ({
    ...g,
    properties: g.properties.filter(
      (p) => !q || p.label.toLowerCase().includes(q) || p.property.includes(q)
    )
  })).filter((g) => g.properties.length > 0);
  const showElement = q ? controls.length > 0 : tab === "element";
  const showDesign = q ? groups.length > 0 : tab === "design";
  const showAction = !q && tab === "action";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-divider p-3">
        <div className="flex items-center gap-2">
          <input
            aria-label="Element name"
            value={node.name ?? definition?.label ?? node.type}
            onChange={(e) => rename(node.id, e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-medium font-medium text-foreground outline-none focus-visible:underline"
          />
          <button
            type="button"
            aria-label="Duplicate element"
            onClick={() => duplicate(node.id)}
            className="rounded p-1.5 text-default-600 hover:text-foreground"
          >
            <Icon name="ph:copy" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label="Copy element"
            onClick={() => copy(node.id)}
            className="rounded p-1.5 text-default-600 hover:text-foreground"
          >
            <Icon name="ph:clipboard" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label="Delete element"
            onClick={() => remove(node.id)}
            className="rounded p-1.5 text-default-600 hover:text-danger"
          >
            <Icon name="ph:trash" width={16} height={16} />
          </button>
        </div>
        {hasClipboard ? (
          <ActionButton size="sm" tone="ghost" onPress={() => paste()}>
            Paste copied element
          </ActionButton>
        ) : null}
        <IdentityField key={node.id} node={node} />
        <div role="tablist" aria-label="Element settings" className="flex gap-1">
          {(["element", "design", "action"] as const).map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setQuery("");
              }}
              className={
                "relative flex-1 rounded-full px-3 py-1.5 text-small capitalize transition-colors duration-300 " +
                (tab === id && !q
                  ? "bg-default-200 text-foreground"
                  : "text-default-600 hover:bg-default-100")
              }
            >
              {id}
              {id === "design" && designDot ? (
                <span
                  role="img"
                  aria-label="Has changes"
                  className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-warning"
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {showElement ? (
          <section className="mb-4 flex flex-col gap-3" aria-label="Element settings">
            {q ? (
              <h3 className="text-tiny font-semibold uppercase text-default-500">Element</h3>
            ) : null}
            {controls.length === 0 ? (
              <p className="text-small text-default-500">This element has no content settings.</p>
            ) : (
              controls.map((control) => (
                <ControlField key={control.key} node={node} control={control} />
              ))
            )}
          </section>
        ) : null}
        {showDesign ? (
          <section className="flex flex-col gap-4" aria-label="Design settings">
            <div role="group" aria-label="Pseudo state" className="flex flex-wrap gap-1">
              {STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={state === s}
                  onClick={() => setState(s)}
                  className={
                    "rounded-full px-2.5 py-1 text-tiny capitalize transition-colors duration-300 " +
                    (state === s
                      ? "bg-default-300 text-foreground"
                      : "bg-default-100 text-default-600 hover:bg-default-200")
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            {groups.map((group) => (
              <details key={group.id} open className="group flex flex-col gap-3">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-small font-medium text-foreground">
                  <DesignIcon id={group.icon} />
                  {group.label}
                  <Icon
                    name="ph:caret-down"
                    width={12}
                    height={12}
                    className="ml-auto transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  {group.properties.map((property) => (
                    <DesignField key={property.property} node={node} property={property} />
                  ))}
                </div>
              </details>
            ))}
            {q && groups.length === 0 ? (
              <p className="text-small text-default-500">No settings match.</p>
            ) : null}
          </section>
        ) : null}
        {showAction ? (
          <p className="text-small text-default-500">Action flows arrive in a later phase.</p>
        ) : null}
        {q && controls.length === 0 && groups.length === 0 ? (
          <p className="text-small text-default-500">No settings match.</p>
        ) : null}
      </div>

      <div className="border-t border-divider p-3">
        <input
          type="search"
          aria-label="Search settings"
          placeholder="Search settings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={compactFieldClass}
        />
      </div>
    </div>
  );
}

export function useSelectedNode(): ElementNode | null {
  const doc = useEditorStore((s) => s.doc);
  const selectedId = useEditorStore((s) => s.selectedId);
  return useMemo(
    () => (doc && selectedId ? (findNode(doc.tree, selectedId)?.node ?? null) : null),
    [doc, selectedId]
  );
}
