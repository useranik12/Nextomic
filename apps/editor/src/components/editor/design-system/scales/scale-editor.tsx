"use client";

import {
  DEFAULT_SCALES,
  MAX_SCALE_STEPS,
  MIN_SCALE_STEPS,
  RATIO_PRESETS,
  addScaleStep,
  applyScale,
  removeScaleStep,
  scaleKind,
  scaleSteps,
  type Framework,
  type ScaleKind,
  type ScaleSettings
} from "@nextomic/schema";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import type { GateProps } from "../framework/framework-gate";

const COPY: Record<ScaleKind, { title: string; size: string; sample: boolean }> = {
  text: { title: "Typography", size: "Font size", sample: true },
  space: { title: "Spacing", size: "Size", sample: false },
  radius: { title: "Radius", size: "Radius", sample: false }
};

const num = (v: string, fallback: number): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

function RatioField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const preset = RATIO_PRESETS.find((p) => p.value === value);
  return (
    <div className="flex flex-col gap-1.5">
      <SelectField
        compact
        label={label}
        value={preset ? String(preset.value) : "custom"}
        options={[
          ...RATIO_PRESETS.map((p) => ({ value: String(p.value), label: p.label })),
          { value: "custom", label: `Custom (${value})` }
        ]}
        onValueChange={(v) => v !== "custom" && onChange(Number(v))}
      />
      <FormInput
        compact
        type="number"
        step="0.001"
        min="1"
        max="3"
        aria-label={`${label} value`}
        value={String(value)}
        onValueChange={(v) => onChange(num(v, value))}
      />
    </div>
  );
}

function Panel({
  title,
  tip,
  children
}: {
  title: string;
  tip: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-divider p-3 last:border-b-0">
      <h3 className="flex items-center gap-1.5 text-tiny font-semibold uppercase text-default-500">
        {title}
        <InfoTip text={tip} />
      </h3>
      {children}
    </section>
  );
}

function Row({ scale, kind, index }: { scale: ScaleSettings; kind: ScaleKind; index: number }) {
  const step = scaleSteps(scale)[index];
  if (!step) return null;
  const base = index === scale.baseIndex;
  const max = Math.max(...scaleSteps(scale).map((s) => s.max));
  return (
    <li
      className={`grid grid-cols-[110px_1fr] items-center gap-3 px-4 py-3 ${base ? "bg-primary/10" : ""}`}
    >
      <div>
        <p className="font-mono text-small">--{step.variable}</p>
        {base ? (
          <span className="rounded-medium bg-primary px-1.5 py-0.5 text-tiny text-white">Base</span>
        ) : null}
      </div>
      {COPY[kind].sample ? (
        <div className="grid grid-cols-[72px_20px_1fr] items-baseline gap-x-2 gap-y-1 overflow-hidden">
          <span className="text-right text-tiny text-default-600">{step.min}px</span>
          <Icon name="ph:device-mobile" width={14} height={14} />
          <span
            style={{ fontSize: Math.min(step.min, 96) }}
            className="truncate leading-tight text-default-500"
          >
            Minimum
          </span>
          <span className="text-right text-tiny text-default-600">{step.max}px</span>
          <Icon name="ph:desktop" width={14} height={14} />
          <span style={{ fontSize: Math.min(step.max, 96) }} className="truncate leading-tight">
            Maximum
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-[72px_20px_1fr] items-center gap-x-2 gap-y-1">
          <span className="text-right text-tiny text-default-600">{step.min}px</span>
          <Icon name="ph:device-mobile" width={14} height={14} />
          <span
            aria-hidden
            style={{
              width: `${(step.min / max) * 100}%`,
              borderRadius: kind === "radius" ? step.min : 2
            }}
            className="block h-3 bg-primary/50"
          />
          <span className="text-right text-tiny text-default-600">{step.max}px</span>
          <Icon name="ph:desktop" width={14} height={14} />
          <span
            aria-hidden
            style={{
              width: `${(step.max / max) * 100}%`,
              borderRadius: kind === "radius" ? step.max : 2
            }}
            className="block h-3 bg-primary"
          />
        </div>
      )}
    </li>
  );
}

/**
 * A fluid scale like Core Framework: base settings on the left (naming, min and max size with
 * their scale ratios, base index, screen range) and every step with its minimum and maximum size
 * on the right. Works on any framework, imported ones included.
 */
export function ScaleEditor({
  kind,
  framework,
  update
}: { kind: ScaleKind } & Pick<GateProps, "framework" | "update">) {
  const copy = COPY[kind];
  const scale = framework.scales.find((s) => scaleKind(s) === kind);

  if (!scale) {
    const fallback = DEFAULT_SCALES.find((s) => s.prefix === kind);
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-small text-default-500">
          This framework has no {copy.title.toLowerCase()} scale. Variables named like{" "}
          <code>--{kind}-m</code> written as clamp() values become one when you import a framework.
        </p>
        {fallback ? (
          <ActionButton size="sm" onPress={() => void update(applyScale(framework, fallback))}>
            Create a {copy.title.toLowerCase()} scale
          </ActionButton>
        ) : null}
      </div>
    );
  }

  const set = (change: Partial<ScaleSettings>) =>
    update(applyScale(framework, { ...scale, ...change }));
  const rename = (prefix: string) => {
    const next = prefix.trim();
    if (next === scale.prefix || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(next)) return;
    const renamed: Framework = {
      ...framework,
      variables: framework.variables.filter(
        (v) => !scale.names.some((n) => v.name === `${scale.prefix}-${n}`)
      ),
      scales: framework.scales.filter((s) => s.prefix !== scale.prefix)
    };
    void update(applyScale(renamed, { ...scale, prefix: next }));
  };
  const swapSteps = (next: ScaleSettings) => update(applyScale(framework, next));

  return (
    <div className="grid h-full min-h-0 grid-cols-[270px_minmax(0,1fr)]">
      <div className="min-h-0 overflow-y-auto border-r border-divider">
        <Panel
          title="Base settings"
          tip="The name every step starts with, for example text makes text-m and text-l. Renaming renames the variables too."
        >
          <FormInput
            compact
            label="Naming convention"
            defaultValue={scale.prefix}
            key={scale.prefix}
            onBlur={(e) => rename(e.target.value)}
          />
        </Panel>
        <Panel
          title={`Min ${copy.size.toLowerCase()}`}
          tip="The size of the base step on the smallest screen, and how fast sizes grow from step to step there (the ratio)."
        >
          <FormInput
            compact
            type="number"
            label="Pixels"
            min="1"
            value={String(scale.baseMin)}
            onValueChange={(v) => void set({ baseMin: num(v, scale.baseMin) })}
          />
          <RatioField
            label="Min scale ratio"
            value={scale.ratioMin}
            onChange={(ratioMin) => void set({ ratioMin })}
          />
        </Panel>
        <Panel
          title={`Max ${copy.size.toLowerCase()}`}
          tip="The size of the base step on the largest screen, and the ratio there. Between the two screens sizes change smoothly."
        >
          <FormInput
            compact
            type="number"
            label="Pixels"
            min="1"
            value={String(scale.baseMax)}
            onValueChange={(v) => void set({ baseMax: num(v, scale.baseMax) })}
          />
          <RatioField
            label="Max scale ratio"
            value={scale.ratioMax}
            onChange={(ratioMax) => void set({ ratioMax })}
          />
        </Panel>
        <Panel
          title="Base scale index"
          tip="Which step is the base size. Steps before it are smaller and steps after it are larger."
        >
          <SelectField
            compact
            label="Base step"
            value={String(scale.baseIndex)}
            options={scale.names.map((n, i) => ({ value: String(i), label: n }))}
            onValueChange={(v) => void set({ baseIndex: Number(v) })}
          />
        </Panel>
        <Panel
          title="Screen range"
          tip="The screen widths between which sizes scale. Below the min width the min size is used, above the max width the max size."
        >
          <div className="grid grid-cols-2 gap-2">
            <FormInput
              compact
              type="number"
              label="Min (px)"
              value={String(scale.minScreen)}
              onValueChange={(v) => void set({ minScreen: Math.round(num(v, scale.minScreen)) })}
            />
            <FormInput
              compact
              type="number"
              label="Max (px)"
              value={String(scale.maxScreen)}
              onValueChange={(v) => void set({ maxScreen: Math.round(num(v, scale.maxScreen)) })}
            />
          </div>
        </Panel>
      </div>
      <div className="flex min-h-0 flex-col">
        <ul
          aria-label={`${copy.title} steps`}
          className="min-h-0 flex-1 divide-y divide-divider overflow-y-auto"
        >
          {scale.names.map((n, i) => (
            <Row key={n} scale={scale} kind={kind} index={i} />
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-divider p-3">
          <ActionButton
            size="sm"
            tone="ghost"
            className="border border-default-200"
            isDisabled={scale.names.length >= MAX_SCALE_STEPS}
            onPress={() => void swapSteps(addScaleStep(scale, "smaller"))}
          >
            Add smaller step
          </ActionButton>
          <ActionButton
            size="sm"
            tone="ghost"
            className="border border-default-200"
            isDisabled={scale.names.length >= MAX_SCALE_STEPS}
            onPress={() => void swapSteps(addScaleStep(scale, "larger"))}
          >
            Add larger step
          </ActionButton>
          <ActionButton
            size="sm"
            tone="danger-ghost"
            isDisabled={scale.names.length <= MIN_SCALE_STEPS || scale.baseIndex === 0}
            onPress={() => void swapSteps(removeScaleStep(scale, "smaller"))}
          >
            Remove smallest
          </ActionButton>
          <ActionButton
            size="sm"
            tone="danger-ghost"
            isDisabled={
              scale.names.length <= MIN_SCALE_STEPS || scale.baseIndex >= scale.names.length - 1
            }
            onPress={() => void swapSteps(removeScaleStep(scale, "larger"))}
          >
            Remove largest
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
