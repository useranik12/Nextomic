"use client";

import { getElementDefinition, type ControlDef } from "@nextomic/renderer";
import {
  canHaveQuery,
  dynamicTextOf,
  findNode,
  hasConditions,
  parseDynamicText,
  type ElementNode,
  tagText
} from "@nextomic/schema";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { Toggle } from "@/components/ui/toggles";
import { IconControl } from "./icon-control";
import { ActionTab } from "../actions/action-tab";
import { Icon } from "@/lib/icons/Icon";
import { ConditionsGroup } from "../conditions/conditions-group";
import { MediaPickerDialog } from "../media/media-picker";
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
  const projectId = useEditorStore((s) => s.projectId);
  const [picking, setPicking] = useState(false);

  if (control.kind === "icon") return <IconControl node={node} control={control} />;
  if (control.kind === "switch") {
    return (
      <Toggle
        label={control.label}
        isSelected={node.props[control.key] === true}
        onChange={(on) => setProp(node.id, control.key, on)}
      />
    );
  }
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
      {node.type === "image" && control.key === "alt" && value.trim() === "" ? (
        <p role="note" className="mb-1 flex items-start gap-1.5 text-xs text-warning">
          <Icon name="ph:warning" width={14} height={14} className="mt-0.5 shrink-0" />
          Missing alt text. Describe the image for screen readers, or leave it empty only if it is
          decoration.
        </p>
      ) : null}
      <div className="relative">
        {control.kind === "textarea" ? (
          <AutoTextarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full resize-none rounded-2xl border border-border bg-transparent py-2 pl-3 pr-9 text-sm text-foreground outline-none transition-colors hover:border-default-400 focus:border-focus"
          />
        ) : (
          <input
            id={id}
            value={value}
            placeholder={control.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={compactFieldClass + (control.pick ? " pr-16" : " pr-9")}
          />
        )}
        {control.pick ? (
          <>
            <button
              type="button"
              aria-label={`Choose ${control.label} from Media`}
              title="Choose from Media"
              onClick={() => setPicking(true)}
              className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-default hover:text-foreground"
            >
              <Icon name="ph:image-square" width={14} height={14} />
            </button>
            <MediaPickerDialog
              projectId={projectId}
              kinds={control.pick}
              isOpen={picking}
              onClose={() => setPicking(false)}
              onPick={(asset) => {
                onChange(asset.path);
                // A picked image brings its alt text along when the element has none yet.
                if (control.key === "src" && asset.alt && !dynamicTextOf(node.props.alt))
                  setProp(node.id, "alt", parseDynamicText(asset.alt));
                setPicking(false);
              }}
            />
          </>
        ) : null}
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
  const sectionRequest = useEditorStore((s) => s.sectionRequest);
  useEffect(() => {
    if (sectionRequest?.id !== node.id) return;
    setTab("element");
    setElementSection(sectionRequest.section);
    useEditorStore.getState().clearSectionRequest();
  }, [sectionRequest, node.id]);
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
    (c) =>
      (!q || c.label.toLowerCase().includes(q)) &&
      (!c.when || dynamicTextOf(node.props[c.when.key]) === c.when.value)
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
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <div className="flex items-start gap-1">
          <RenameField
            key={node.id}
            node={node}
            fallback={definition?.label ?? node.type}
            autoFocus={renamingId === node.id}
            onDone={() => setRenamingId(null)}
            className="text-base font-medium text-foreground"
          />
          <button
            type="button"
            aria-label="Duplicate element"
            onClick={() => duplicate(node.id)}
            className="rounded p-1.5 text-body hover:text-foreground"
          >
            <Icon name="ph:copy" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label="Rename element"
            title="Rename"
            onClick={() => setRenamingId(node.id)}
            className="rounded p-1.5 text-body hover:text-foreground"
          >
            <Icon name="ph:pencil-simple" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label="Copy element"
            onClick={() => copy(node.id)}
            className="rounded p-1.5 text-body hover:text-foreground"
          >
            <Icon name="ph:clipboard" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label="Delete element"
            onClick={() => remove(node.id)}
            className="rounded p-1.5 text-body hover:text-danger"
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
                "relative h-10 flex-1 rounded-xl px-3 text-sm font-bold uppercase tracking-wide transition-colors duration-300 " +
                (tab === id && !q
                  ? "bg-default-hover text-foreground"
                  : "text-muted hover:bg-default")
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
                <p className="text-sm text-muted">This element has no content settings.</p>
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
            {!q || "conditions visibility".includes(q) ? (
              <AccordionSection
                id="conditions"
                title="Conditions"
                icon={<Icon name="ph:git-fork" width={18} height={18} />}
                open={q ? true : elementSection === "conditions"}
                onToggle={toggleElementSection}
                changed={hasConditions(node.visibility)}
              >
                <ConditionsGroup node={node} />
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
              <p className="text-sm text-muted">No settings match.</p>
            ) : null}
          </div>
        ) : null}
        {showAction ? <ActionTab key={node.id} node={node} /> : null}
        {q && controls.length === 0 && groups.length === 0 ? (
          <p className="text-sm text-muted">No settings match.</p>
        ) : null}
      </div>

      <div className="border-t border-border p-3">
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
