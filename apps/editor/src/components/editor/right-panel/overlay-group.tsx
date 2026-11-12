"use client";

import {
  SHEET_ENTRY_ANIMATIONS,
  TEMPLATE_TYPE_LABELS,
  type OverlayTemplateType,
  type TemplateSettings
} from "@nextomic/schema";
import { FormInput, MultiSelectField } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import type { TemplateSummary } from "@/server/templates";
import { useEditorStore } from "../store/editor-store";
import { AnimationPicker } from "./css-animation-panel";
import { compactFieldClass } from "./setting-row";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-body">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0, min, max))}
        className={compactFieldClass}
      />
    </label>
  );
}

/** Modal and bottom sheet templates: their overlay, stacking order and (sheets) entrance. */
export function OverlayGroup({
  type,
  settings,
  templates,
  onChange
}: {
  type: OverlayTemplateType;
  settings: TemplateSettings;
  templates: readonly TemplateSummary[];
  onChange: (patch: Partial<TemplateSettings>) => void;
}) {
  const selfId = useEditorStore((s) => s.page?.id);
  const { overlay, entry } = settings;
  const others = templates.filter((t) => t.type === type && t.id !== selfId);
  return (
    <>
      <section aria-label="Overlay" className="flex flex-col gap-3">
        <h3 className="text-sm text-body">Overlay</h3>
        <SwitchRow
          label="Disable overlay"
          tip="Shows the template without the layer behind it."
          selected={overlay.disabled}
          onChange={(disabled) => onChange({ overlay: { ...overlay, disabled } })}
        />
        {overlay.disabled ? null : (
          <>
            <FormInput
              compact
              label="Background color"
              value={overlay.color}
              onValueChange={(color) =>
                onChange({ overlay: { ...overlay, color: color.replace(/[{};<>]/g, "") } })
              }
              description="Any CSS color. Default is black at 10%."
            />
            <NumberField
              label="Background opacity (0 to 1)"
              value={overlay.opacity}
              min={0}
              max={1}
              step={0.1}
              onChange={(opacity) => onChange({ overlay: { ...overlay, opacity } })}
            />
          </>
        )}
      </section>
      <section aria-label="Stacking" className="flex flex-col gap-3">
        <h3 className="text-sm text-body">Stacking</h3>
        <MultiSelectField
          compact
          label="Show above"
          options={others.map((t) => ({ value: t.id, label: t.name }))}
          values={settings.showAbove}
          onValuesChange={(showAbove) => onChange({ showAbove })}
          placeholder="None"
          description={`${TEMPLATE_TYPE_LABELS[type]} templates this one sits above when both are open. Toasts always sit above modals, and modals above bottom sheets.`}
        />
      </section>
      {type === "bottom-sheet" ? (
        <section aria-label="Entrance" className="flex flex-col gap-3">
          <h3 className="text-sm text-body">Entrance</h3>
          <AnimationPicker
            value={entry.animation}
            only={SHEET_ENTRY_ANIMATIONS}
            onChange={(animation) => onChange({ entry: { ...entry, animation } })}
          />
          <NumberField
            label="Duration (ms)"
            value={entry.durationMs}
            min={0}
            max={5000}
            step={50}
            onChange={(durationMs) => onChange({ entry: { ...entry, durationMs } })}
          />
          <NumberField
            label="Delay (ms)"
            value={entry.delayMs}
            min={0}
            max={5000}
            step={50}
            onChange={(delayMs) => onChange({ entry: { ...entry, delayMs } })}
          />
        </section>
      ) : null}
    </>
  );
}
