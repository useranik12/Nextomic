"use client";

import { getElementDefinition, type ControlDef } from "@nextomic/renderer";
import {
  canHaveQuery,
  dynamicTextOf,
  findNode,
  parseDynamicText,
  type ElementNode,
  tagText
} from "@nextomic/schema";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { QueryLoopGroup } from "../query/query-loop-group";
import { RenameField } from "../rename-field";
import { useEditorStore } from "../store/editor-store";
import { STATUS_DOT } from "../top-bar";
import { DESIGN_GROUPS } from "./design-groups";
import { GroupBody } from "./group-body";
import { AccordionSection } from "./accordion";
import { CssAnimationPanel } from "./css-animation-panel";
import { AutoTextarea } from "./auto-textarea";
import { AttributesEditor } from "./attributes-editor";
import { ConvertToClass } from "./convert-to-class";
import { CssEditor } from "./css-editor";
import { DesignIcon } from "./design-icons";
import { DynamicBolt } from "./dynamic-bolt";
import { IdentityField } from "./identity-field";
import { SettingRow, compactFieldClass } from "./setting-row";

type Tab = "element" | "design" | "action";

function ControlField({ node, control }: { node: ElementNode; control: ControlDef }) {
  const id = useId();
  const setProp = useEditorStore((s) => s.setElementProp);
  const setTag = useEditorStore((s) => s.setElementTag);
  const isTag = control.key === "htmlTag";
  const value = isTag
    ? (node.htmlTag ?? control.options?.[0]?.value ?? "")
    : dynamicTextOf(node.props[control.key]);
  const onChange = (next: string) =>
    isTag ? setTag(node.id, next) : setProp(node.id, control.key, parseDynamicText(next));
  const insertToken = (token: string) => onChange(`${value}${tagText(token)}`);

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
          <AutoTextarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full resize-none rounded-large border border-default-200 bg-transparent py-2 pl-3 pr-9 text-small text-foreground outline-none transition-colors hover:border-default-400 focus:border-default-800"
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

export function ElementPanel({ node }: { node: ElementNode }) {
  const definition = getElementDefinition(node.type);
  const [tab, setTab] = useState<Tab>("element");
  const [elementSection, setElementSection] = useState("general");
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const bp = useEditorStore((s) => s.activeBreakpointId);
  const duplicate = useEditorStore((s) => s.duplicateElement);
  const copy = useEditorStore((s) => s.copyElement);
  const paste = useEditorStore((s) => s.pasteElement);
  const remove = useEditorStore((s) => s.removeElement);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const hasClipboard = useEditorStore((s) => s.clipboard !== null);
  const hideBorderSetting = useEditorStore((s) => s.project.hideEditBorder);
  const designGroup = useEditorStore((s) => s.designGroup);
  const setDesignGroup = useEditorStore((s) => s.setDesignGroup);
  const setHideSelection = useEditorStore((s) => s.setHideSelection);
  const memory = useEditorStore((s) => s.designMemory[node.id]);
  const rememberDesign = useEditorStore((s) => s.rememberDesign);
  const renamingId = useEditorStore((s) => s.renamingId);
  const setRenamingId = useEditorStore((s) => s.setRenamingId);

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

  // Opening an element's Design tab shows the group (and setting) it was last edited in.
  const memoryGroup = memory?.group;
  const memoryProperty = memory?.property;
  useEffect(() => {
    if (tab !== "design") return;
    // An element never opened keeps the group that was open last.
    if (memoryGroup !== undefined) setDesignGroup(memoryGroup);
    if (!memoryProperty) return;
    const frame = requestAnimationFrame(() => {
      scroller.current
        ?.querySelector(`[data-design-property="${CSS.escape(memoryProperty)}"]`)
        ?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
    // Only when the element or tab changes, not on every edit.
  }, [node.id, tab]);

  // The selection outline hides while Border settings are open, when App Settings asks for it.
  const editingBorder = tab === "design" && !q && designGroup === "border";
  useEffect(() => {
    setHideSelection(hideBorderSetting && editingBorder);
    return () => setHideSelection(false);
  }, [hideBorderSetting, editingBorder, setHideSelection]);

  const toggleGroup = (id: string) => {
    const opening = designGroup !== id;
    setDesignGroup(opening ? id : null);
    if (opening) rememberDesign(node.id, id, memory?.group === id ? memory.property : "");
  };
  const toggleElementSection = (id: string) => setElementSection(elementSection === id ? "" : id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-divider p-3">
        <div className="flex items-start gap-1">
          <RenameField
            key={node.id}
            node={node}
            fallback={definition?.label ?? node.type}
            autoFocus={renamingId === node.id}
            onDone={() => setRenamingId(null)}
            className="text-medium font-medium text-foreground"
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
            aria-label="Rename element"
            title="Rename"
            onClick={() => setRenamingId(node.id)}
            className="rounded p-1.5 text-default-600 hover:text-foreground"
          >
            <Icon name="ph:pencil-simple" width={16} height={16} />
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
                "relative h-10 flex-1 rounded-medium px-3 text-small font-bold uppercase tracking-wide transition-colors duration-300 " +
                (tab === id && !q
                  ? "bg-default-200 text-foreground"
                  : "text-default-500 hover:bg-default-100")
              }
            >
              {id}
              {id === "design" && designDot ? (
                <span
                  role="img"
                  aria-label="Has changes"
                  className={`absolute right-2.5 top-3 h-1.5 w-1.5 rounded-full ${STATUS_DOT[saveStatus]}`}
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-3">
        {showElement ? (
          <div className="mb-2 flex flex-col" aria-label="Element settings">
            <AccordionSection
              id="general"
              title="General"
              icon={<Icon name="ph:sliders-horizontal" width={18} height={18} />}
              open={q ? true : elementSection === "general"}
              onToggle={toggleElementSection}
            >
              {controls.length === 0 ? (
                <p className="text-small text-default-500">This element has no content settings.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {controls.map((control) => (
                    <ControlField key={control.key} node={node} control={control} />
                  ))}
                </div>
              )}
            </AccordionSection>
            {canHaveQuery(node.type) && (!q || "query loop".includes(q)) ? (
              <AccordionSection
                id="query"
                title="Query Loop"
                icon={<Icon name="ph:database" width={18} height={18} />}
                open={q ? true : elementSection === "query"}
                onToggle={toggleElementSection}
                changed={node.query?.enabled ?? false}
              >
                <QueryLoopGroup node={node} />
              </AccordionSection>
            ) : null}
            {!q || "attributes".includes(q) ? (
              <AccordionSection
                id="attributes"
                title="Attributes"
                icon={<Icon name="ph:tag" width={18} height={18} />}
                open={q ? true : elementSection === "attributes"}
                onToggle={toggleElementSection}
                changed={Object.keys(node.attributes ?? {}).length > 0}
              >
                <AttributesEditor node={node} />
              </AccordionSection>
            ) : null}
          </div>
        ) : null}
        {showDesign ? (
          <div className="flex flex-col" aria-label="Design settings">
            {groups.map((group) => (
              <AccordionSection
                key={group.id}
                id={group.id}
                title={group.label}
                icon={<DesignIcon id={group.icon} />}
                open={q ? true : designGroup === group.id}
                onToggle={toggleGroup}
              >
                <GroupBody node={node} groupId={group.id} properties={group.properties} />
              </AccordionSection>
            ))}
            {!q || "animations".includes(q) ? (
              <AccordionSection
                id="animations"
                title="Animations"
                icon={<Icon name="ph:sparkle" width={18} height={18} />}
                open={q ? true : designGroup === "animations"}
                onToggle={toggleGroup}
                changed={node.animation !== undefined}
              >
                <CssAnimationPanel node={node} />
              </AccordionSection>
            ) : null}
            {!q || "css".includes(q) ? (
              <AccordionSection
                id="css"
                title="CSS"
                icon={<Icon name="ph:code" width={18} height={18} />}
                open={q ? true : designGroup === "css"}
                onToggle={toggleGroup}
              >
                <CssEditor key={node.id} node={node} />
                <ConvertToClass node={node} />
              </AccordionSection>
            ) : null}
            {q && groups.length === 0 ? (
              <p className="text-small text-default-500">No settings match.</p>
            ) : null}
          </div>
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
