"use client";

import type { StickyHeader } from "@nextomic/schema";
import { SwitchRow } from "@/components/ui/switch-row";
import { AnimationPicker } from "./css-animation-panel";
import { LengthInput } from "./length-input";
import { bareFieldClass, compactFieldClass, fieldShellClass } from "./setting-row";

function LengthField({
  label,
  tip,
  value,
  onChange
}: {
  label: string;
  tip: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-body">{label}</span>
      <div className={fieldShellClass}>
        <div className="min-w-0 flex-1">
          <LengthInput
            noPreview
            property="padding-top"
            ariaLabel={label}
            value={value === "" ? undefined : value}
            placeholder="0"
            onChange={(next) => onChange(next ?? "")}
            fieldClass={bareFieldClass}
          />
        </div>
      </div>
      <span className="text-xs text-muted">{tip}</span>
    </div>
  );
}

/** Header templates only: stick to the top, slide away and come back while scrolling. */
export function StickyHeaderGroup({
  value,
  onChange
}: {
  value: StickyHeader;
  onChange: (value: StickyHeader) => void;
}) {
  const set = (patch: Partial<StickyHeader>) => onChange({ ...value, ...patch });
  return (
    <section aria-label="Sticky header" className="flex flex-col gap-3">
      <h3 className="text-sm text-body">Sticky header</h3>
      <SwitchRow
        label="Sticky header"
        tip="Keeps the header at the top of the window while the page scrolls."
        selected={value.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      {value.enabled ? (
        <>
          <LengthField
            label="Sticky after"
            tip="The header sticks once the page has scrolled this far."
            value={value.stickyAfter}
            onChange={(stickyAfter) => set({ stickyAfter })}
          />
          <LengthField
            label="Slide up after"
            tip="The header slides out of view once the page has scrolled this far. Empty keeps it."
            value={value.slideAfter}
            onChange={(slideAfter) => set({ slideAfter })}
          />
          <AnimationPicker value={value.animation} onChange={(animation) => set({ animation })} />
          <label className="flex flex-col gap-1 text-xs font-medium text-body">
            Slide in and out duration (ms)
            <input
              type="number"
              min={0}
              max={5000}
              step={50}
              value={value.duration}
              onChange={(e) =>
                set({
                  duration: Math.min(5000, Math.max(0, Math.round(Number(e.target.value) || 0)))
                })
              }
              className={compactFieldClass}
            />
          </label>
          <SwitchRow
            label="Sticky on scroll"
            tip="Past the slide distance, the header hides when scrolling down and comes back when scrolling up."
            selected={value.onScroll}
            onChange={(onScroll) => set({ onScroll })}
          />
        </>
      ) : null}
    </section>
  );
}
