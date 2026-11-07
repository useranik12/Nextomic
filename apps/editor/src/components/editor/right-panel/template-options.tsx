"use client";

import {
  LAYOUT_AUTO,
  LAYOUT_NONE,
  TEMPLATE_TYPE_LABELS,
  type TemplateSettings
} from "@nextomic/schema";
import { useEffect, useState } from "react";
import { listTemplatesAction } from "@/app/(builder)/editor/[id]/library-actions";
import { SelectField } from "@/components/ui/controls";
import type { TemplateSummary } from "@/server/templates";
import { RuleBuilder } from "../rules/rule-builder";
import { useEditorStore } from "../store/editor-store";
import { BoltInput } from "./bolt-input";
import { MarkingGroup } from "./marking-group";
import { StatusField } from "./status-field";
import { StickyHeaderGroup } from "./sticky-header-group";
import { compactFieldClass } from "./setting-row";

/** Header and footer choice: the one that applies by its rules, none, or a specific template. */
export function HeaderFooterFields({
  header,
  footer,
  templates,
  onChange
}: {
  header: string;
  footer: string;
  templates: readonly TemplateSummary[];
  onChange: (change: { header?: string; footer?: string }) => void;
}) {
  const options = (slot: "header" | "footer") => [
    { value: LAYOUT_AUTO, label: "Auto (rules decide)" },
    { value: LAYOUT_NONE, label: "None" },
    ...templates
      .filter((t) => t.type === slot)
      .map((t) => ({
        value: t.id,
        label: t.status === "published" ? t.name : `${t.name} (draft)`
      }))
  ];
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        compact
        label="Header"
        value={header}
        options={options("header")}
        onValueChange={(v) => onChange({ header: v })}
      />
      <SelectField
        compact
        label="Footer"
        value={footer}
        options={options("footer")}
        onValueChange={(v) => onChange({ footer: v })}
      />
    </div>
  );
}

/** Loads the project's templates once for the pickers in a panel. */
export function useTemplateList(): TemplateSummary[] {
  const projectId = useEditorStore((s) => s.projectId);
  const [list, setList] = useState<TemplateSummary[]>([]);
  useEffect(() => {
    let live = true;
    void listTemplatesAction(projectId).then((r) => {
      if (live && r.error === null) setList(r.data);
    });
    return () => {
      live = false;
    };
  }, [projectId]);
  return list;
}

/** Template settings: status, priority, theme, where it applies and (headers) sticky behavior. */
export function TemplateSettingsFields() {
  const type = useEditorStore((s) => s.page?.templateType);
  const settings = useEditorStore((s) => s.doc?.template);
  const themes = useEditorStore((s) => s.project.themes);
  const update = useEditorStore((s) => s.updateTemplateSettings);
  const templates = useTemplateList();
  if (!settings || !type) return null;
  const set = (patch: Partial<TemplateSettings>) => update(patch);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Template" className="flex flex-col gap-3">
        <p className="text-small text-default-600">
          Type: <span className="text-foreground">{TEMPLATE_TYPE_LABELS[type]}</span>
        </p>
        <BoltInput
          label="Internal description"
          value={settings.description}
          onValueChange={(description) => set({ description })}
        />
        <StatusField
          status={settings.status}
          scheduledAt={settings.scheduledAt}
          onChange={(change) => set(change)}
          tip="A draft template is never used on a page. Scheduled templates apply from their time."
        />
        {type === "error-404" ? null : (
          <label className="flex flex-col gap-1 text-tiny text-default-600">
            Priority
            <input
              type="number"
              min={0}
              max={1000}
              value={settings.priority}
              onChange={(e) =>
                set({
                  priority: Math.min(1000, Math.max(0, Math.round(Number(e.target.value) || 0)))
                })
              }
              className={compactFieldClass}
            />
            <span className="text-tiny text-default-500">
              When several templates of this type match a page, the highest number wins.
            </span>
          </label>
        )}
        <SelectField
          compact
          label="Theme"
          value={settings.themeId ?? ""}
          options={[
            { value: "", label: "Follow the page" },
            ...themes.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name }))
          ]}
          onValueChange={(themeId) => set({ themeId: themeId || null })}
        />
      </section>
      {type === "error-404" ? (
        <section aria-label="Layout" className="flex flex-col gap-3">
          <h3 className="text-small text-default-600">Header and footer</h3>
          <HeaderFooterFields
            header={settings.header}
            footer={settings.footer}
            templates={templates}
            onChange={set}
          />
        </section>
      ) : (
        <RuleBuilder value={settings.rules} onChange={(rules) => set({ rules })} />
      )}
      {type === "header" ? (
        <StickyHeaderGroup value={settings.sticky} onChange={(sticky) => set({ sticky })} />
      ) : null}
    </div>
  );
}

/** Right panel with nothing selected, while a template is open: its categories and tags. */
export function TemplateOptions() {
  const settings = useEditorStore((s) => s.doc?.template);
  const update = useEditorStore((s) => s.updateTemplateSettings);
  const id = useEditorStore((s) => s.page?.id);
  if (!settings) return null;
  return (
    <div key={id} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      <MarkingGroup
        scope="template"
        categoryIds={settings.categoryIds}
        tagIds={settings.tagIds}
        onChange={(change) => update(change)}
      />
      <p className="text-tiny text-default-500">
        Status, conditions and other template settings are under the settings icon in the top bar.
      </p>
    </div>
  );
}
