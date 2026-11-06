"use client";

import {
  spaceScale,
  typeScale,
  type FluidSize,
  type ProjectVariable,
  type SpaceScaleOptions,
  type TypeScaleOptions
} from "@nextomic/schema";
import { useMemo, useState, type ReactNode } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";

const TYPE_DEFAULTS: TypeScaleOptions = {
  baseMin: 16,
  baseMax: 20,
  ratioMin: 1.2,
  ratioMax: 1.25,
  minViewport: 320,
  maxViewport: 1240,
  stepsDown: 2,
  stepsUp: 5
};

const SPACE_DEFAULTS: SpaceScaleOptions = {
  baseMin: 16,
  baseMax: 20,
  minViewport: 320,
  maxViewport: 1240
};

function Num({
  label,
  value,
  onChange,
  step
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
}) {
  return (
    <FormInput
      compact
      type="number"
      label={label}
      step={step}
      value={String(value)}
      onValueChange={(next) => {
        const n = Number(next);
        if (next !== "" && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function problem(o: {
  baseMin: number;
  baseMax: number;
  minViewport: number;
  maxViewport: number;
  ratioMin?: number;
  ratioMax?: number;
}): string | null {
  if (o.baseMin <= 0 || o.baseMax <= 0) return "Base sizes must be above 0.";
  if (o.minViewport < 200 || o.maxViewport > 4000 || o.minViewport >= o.maxViewport)
    return "The min viewport must be below the max viewport (200 to 4000 px).";
  if (o.ratioMin !== undefined && o.ratioMax !== undefined) {
    if (o.ratioMin < 1 || o.ratioMin > 3 || o.ratioMax < 1 || o.ratioMax > 3)
      return "Ratios go from 1 to 3.";
  }
  return null;
}

function sizeLabel(f: FluidSize | undefined): string {
  if (!f) return "";
  const r = (n: number) => Math.round(n * 100) / 100;
  return f.min === f.max ? `${r(f.min)}px` : `${r(f.min)} - ${r(f.max)}px`;
}

function Layout({
  title,
  intro,
  form,
  error,
  preview,
  onApply,
  count
}: {
  title: string;
  intro: string;
  form: ReactNode;
  error: string | null;
  preview: ReactNode;
  onApply: () => void;
  count: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-divider p-4">
        <h3 className="text-small font-medium">{title}</h3>
        <p className="mt-1 text-tiny text-default-500">{intro}</p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-0">
        <div className="flex flex-col gap-3 overflow-y-auto border-r border-divider p-4">
          {form}
          {error ? (
            <p role="alert" className="text-tiny text-danger">
              {error}
            </p>
          ) : null}
          <ActionButton onPress={onApply} isDisabled={error !== null}>
            Apply {count} variables
          </ActionButton>
          <p className="text-tiny text-default-500">
            Applying adds the variables below, or updates the ones with the same names.
          </p>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">{preview}</div>
      </div>
    </div>
  );
}

function initial<T extends object>(
  defaults: T,
  found: FluidSize | undefined,
  keys: [keyof T, keyof T]
): T {
  if (!found) return defaults;
  return { ...defaults, [keys[0]]: found.min, [keys[1]]: found.max } as T;
}

export function TypographyTab() {
  const existing = useEditorStore(
    (s) => s.project.variables.find((v) => v.name === "text-m")?.fluid
  );
  const [o, setO] = useState<TypeScaleOptions>(() =>
    initial(TYPE_DEFAULTS, existing, ["baseMin", "baseMax"])
  );
  const error = problem(o);
  const vars = useMemo(() => (error ? [] : typeScale(o)), [o, error]);
  const set = (patch: Partial<TypeScaleOptions>) => setO((cur) => ({ ...cur, ...patch }));

  return (
    <Layout
      title="Fluid typography"
      intro="Text sizes that grow smoothly between two viewport widths (a CSS clamp). Creates --nxt-text-xs ... --nxt-text-5xl around --nxt-text-m."
      error={error}
      count={vars.length}
      onApply={() => useEditorStore.getState().upsertVariables(vars)}
      form={
        <>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Base min (px)" value={o.baseMin} onChange={(baseMin) => set({ baseMin })} />
            <Num label="Base max (px)" value={o.baseMax} onChange={(baseMax) => set({ baseMax })} />
            <Num
              label="Ratio min"
              step={0.01}
              value={o.ratioMin}
              onChange={(ratioMin) => set({ ratioMin })}
            />
            <Num
              label="Ratio max"
              step={0.01}
              value={o.ratioMax}
              onChange={(ratioMax) => set({ ratioMax })}
            />
            <Num
              label="Min viewport"
              value={o.minViewport}
              onChange={(minViewport) => set({ minViewport })}
            />
            <Num
              label="Max viewport"
              value={o.maxViewport}
              onChange={(maxViewport) => set({ maxViewport })}
            />
            <Num
              label="Steps down"
              value={o.stepsDown}
              onChange={(n) => set({ stepsDown: Math.max(0, Math.min(4, Math.round(n))) })}
            />
            <Num
              label="Steps up"
              value={o.stepsUp}
              onChange={(n) => set({ stepsUp: Math.max(0, Math.min(7, Math.round(n))) })}
            />
          </div>
        </>
      }
      preview={
        <ul className="flex flex-col">
          {[...vars].reverse().map((v) => (
            <li key={v.name} className="flex items-baseline gap-4 border-b border-divider py-2">
              <span className="w-16 shrink-0 font-mono text-tiny text-default-500">
                {v.name.replace("text-", "")}
              </span>
              <span className="w-28 shrink-0 text-tiny text-default-500">{sizeLabel(v.fluid)}</span>
              <span
                className="min-w-0 truncate leading-tight text-foreground"
                style={{ fontSize: `min(${v.value}, 72px)` }}
              >
                The quick brown fox
              </span>
            </li>
          ))}
        </ul>
      }
    />
  );
}

export function SpacingTab() {
  const existing = useEditorStore(
    (s) => s.project.variables.find((v) => v.name === "space-s")?.fluid
  );
  const [o, setO] = useState<SpaceScaleOptions>(() =>
    initial(SPACE_DEFAULTS, existing, ["baseMin", "baseMax"])
  );
  const error = problem(o);
  const vars: ProjectVariable[] = useMemo(() => (error ? [] : spaceScale(o)), [o, error]);
  const set = (patch: Partial<SpaceScaleOptions>) => setO((cur) => ({ ...cur, ...patch }));

  return (
    <Layout
      title="Fluid spacing"
      intro="A spacing scale made of multiples of one base, each fluid. Creates --nxt-space-3xs ... --nxt-space-3xl for gaps, padding and margins."
      error={error}
      count={vars.length}
      onApply={() => useEditorStore.getState().upsertVariables(vars)}
      form={
        <div className="grid grid-cols-2 gap-3">
          <Num label="Base min (px)" value={o.baseMin} onChange={(baseMin) => set({ baseMin })} />
          <Num label="Base max (px)" value={o.baseMax} onChange={(baseMax) => set({ baseMax })} />
          <Num
            label="Min viewport"
            value={o.minViewport}
            onChange={(minViewport) => set({ minViewport })}
          />
          <Num
            label="Max viewport"
            value={o.maxViewport}
            onChange={(maxViewport) => set({ maxViewport })}
          />
        </div>
      }
      preview={
        <ul className="flex flex-col">
          {vars.map((v) => (
            <li key={v.name} className="flex items-center gap-4 border-b border-divider py-2">
              <span className="w-16 shrink-0 font-mono text-tiny text-default-500">
                {v.name.replace("space-", "")}
              </span>
              <span className="w-28 shrink-0 text-tiny text-default-500">{sizeLabel(v.fluid)}</span>
              <span
                className="h-3 rounded-full bg-primary/70"
                style={{ width: `min(${v.value}, 100%)` }}
              />
            </li>
          ))}
        </ul>
      }
    />
  );
}
