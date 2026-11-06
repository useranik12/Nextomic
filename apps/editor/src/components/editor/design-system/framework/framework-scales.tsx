"use client";

import {
  RATIO_PRESETS,
  applyScale,
  scaleSteps,
  type Framework,
  type ScaleSettings
} from "@nextomic/schema";
import { FormInput, SelectField } from "@/components/ui/controls";

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
    <div className="flex items-end gap-2">
      <div className="w-28">
        <FormInput
          compact
          type="number"
          step="0.001"
          label={label}
          value={String(value)}
          onValueChange={(v) => onChange(num(v, value))}
        />
      </div>
      <div className="w-44">
        <SelectField
          compact
          hideLabel
          label={`${label} preset`}
          value={preset ? String(preset.value) : "custom"}
          options={[
            { value: "custom", label: "Custom" },
            ...RATIO_PRESETS.map((p) => ({ value: String(p.value), label: p.label }))
          ]}
          onValueChange={(v) => v !== "custom" && onChange(Number(v))}
        />
      </div>
    </div>
  );
}

function ScaleEditor({
  scale,
  onChange
}: {
  scale: ScaleSettings;
  onChange: (s: ScaleSettings) => void;
}) {
  const steps = scaleSteps(scale);
  const set = (change: Partial<ScaleSettings>) => onChange({ ...scale, ...change });
  return (
    <section className="flex flex-col gap-3 rounded-large border border-divider p-3">
      <h3 className="text-small font-semibold capitalize">{scale.prefix} scale</h3>
      <div className="flex flex-wrap items-end gap-3">
        <RatioField
          label="Minor ratio"
          value={scale.ratioMin}
          onChange={(ratioMin) => set({ ratioMin })}
        />
        <RatioField
          label="Major ratio"
          value={scale.ratioMax}
          onChange={(ratioMax) => set({ ratioMax })}
        />
      </div>
      <p className="text-tiny text-default-500">
        The minor ratio applies at the min screen, the major ratio at the max screen.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <FormInput
          compact
          type="number"
          label="Base min (px)"
          value={String(scale.baseMin)}
          onValueChange={(v) => set({ baseMin: num(v, scale.baseMin) })}
        />
        <FormInput
          compact
          type="number"
          label="Base max (px)"
          value={String(scale.baseMax)}
          onValueChange={(v) => set({ baseMax: num(v, scale.baseMax) })}
        />
        <SelectField
          compact
          label="Base index"
          value={String(scale.baseIndex)}
          options={scale.names.map((n, i) => ({ value: String(i), label: `${i} · ${n}` }))}
          onValueChange={(v) => set({ baseIndex: Number(v) })}
        />
        <FormInput
          compact
          type="number"
          label="Min screen (px)"
          value={String(scale.minScreen)}
          onValueChange={(v) => set({ minScreen: Math.round(num(v, scale.minScreen)) })}
        />
        <FormInput
          compact
          type="number"
          label="Max screen (px)"
          value={String(scale.maxScreen)}
          onValueChange={(v) => set({ maxScreen: Math.round(num(v, scale.maxScreen)) })}
        />
      </div>
      <table className="w-full text-tiny">
        <thead>
          <tr className="text-left text-default-500">
            <th className="py-1 font-medium">Step</th>
            <th className="font-medium">Variable</th>
            <th className="font-medium">Min</th>
            <th className="font-medium">Max</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={s.name} className={i === scale.baseIndex ? "bg-default-100 font-medium" : ""}>
              <td className="py-1 pl-1">{s.name}</td>
              <td className="font-mono">--{s.variable}</td>
              <td>{s.min}px</td>
              <td>{s.max}px</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Scale controls (ratios, base size and index, screen range). Every change regenerates the variables. */
export function FrameworkScales({
  framework,
  onChange
}: {
  framework: Framework;
  onChange: (fw: Framework) => string | null;
}) {
  if (framework.scales.length === 0) {
    return (
      <p className="p-4 text-small text-default-500">
        No fluid scales found. Variables named like <code>--text-m</code> or <code>--space-m</code>{" "}
        written as clamp() values become scales on import.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      {framework.scales.map((s) => (
        <ScaleEditor
          key={s.prefix}
          scale={s}
          onChange={(next) => void onChange(applyScale(framework, next))}
        />
      ))}
    </div>
  );
}
