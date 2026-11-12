"use client";

import { SwitchField as Switch } from "@/components/ui/toggles";
import {
  MAX_SHADES,
  UTILITY_PROPS,
  colorGroups,
  moveColor,
  removeColor,
  setColorOptions,
  setColorValue,
  darkVariant,
  shadesOf,
  transparentPercents,
  type ColorOptions,
  type ColorResult,
  type Framework,
  type FrameworkColor
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { ColorField } from "@/components/ui/color-field";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import { ShadeRow } from "./shade-grid";

function OptionSwitch({
  label,
  hint,
  tip,
  selected,
  onChange,
  children,
  below
}: {
  label: string;
  hint?: string;
  tip: string;
  selected: boolean;
  onChange: (on: boolean) => void;
  /** Controls shown beside the switch while it is on. */
  children?: React.ReactNode;
  /** Content shown under the option while it is on (the shade boxes). */
  below?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {label}
            <InfoTip text={tip} />
          </p>
          {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {selected ? children : null}
          <Switch size="sm" isSelected={selected} onValueChange={onChange} aria-label={label} />
        </div>
      </div>
      {selected ? below : null}
    </div>
  );
}

/** A number with minus and plus buttons, kept within min and max. */
function Stepper({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  const button =
    "flex h-7 w-7 items-center justify-center rounded-full border border-border text-body transition-colors duration-300 hover:bg-default disabled:opacity-40";
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        disabled={value <= min}
        onClick={() => step(-1)}
        className={button}
      >
        <Icon name="ph:minus" width={14} height={14} />
      </button>
      <span aria-live="polite" className="w-6 text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => step(1)}
        className={button}
      >
        <Icon name="ph:plus" width={14} height={14} />
      </button>
    </div>
  );
}

/** One color: swatch with picker, name, value and the options that generate shades and classes. */
export function ColorRow({
  color,
  framework,
  used,
  darkMode,
  open,
  onToggle,
  onChange,
  onRename
}: {
  color: FrameworkColor;
  framework: Framework;
  used: number;
  /** The theme has dark mode on; without it the dark value option is hidden. */
  darkMode: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: (apply: (fw: Framework) => ColorResult) => string | null;
  /** Renames the color and everything that uses it. Returns an error message or null. */
  onRename: (from: string, to: string) => string | null;
}) {
  const [name, setName] = useState(color.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const options = color.options;
  const setOptions = (patch: Partial<ColorOptions>) =>
    onChange((fw) => setColorOptions(fw, color.name, { ...options, ...patch }));

  function commitName() {
    const next = name.trim();
    if (next === color.name) return setNameError(null);
    const failed = onRename(color.name, next);
    setNameError(failed);
    if (failed) setName(color.name);
  }

  const toggleUtility = (property: ColorOptions["utility"][number]) =>
    setOptions({
      utility: options.utility.includes(property)
        ? options.utility.filter((p) => p !== property)
        : [...options.utility, property]
    });

  const override = (suffix: string, value: string | null) => {
    const overrides = { ...options.overrides };
    if (value === null) delete overrides[suffix];
    else overrides[suffix] = value;
    setOptions({ overrides });
  };

  const shadeCount = shadesOf(color.name, options).length;
  return (
    <li className="rounded-2xl border border-border">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-2 p-2">
        <div className="flex min-w-0 items-center gap-1 rounded-full bg-default px-3">
          <span aria-hidden className="font-mono text-xs text-muted">
            var(--
          </span>
          <input
            aria-label={`Name of ${color.name}`}
            value={name}
            title={
              used > 0
                ? `Used ${used} time${used === 1 ? "" : "s"} on this page; they follow when you rename it.`
                : undefined
            }
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setName(color.name);
            }}
            className="h-8 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
          />
          <span aria-hidden className="font-mono text-xs text-muted">
            )
          </span>
        </div>
        <ColorField
          label={`Value of ${color.name}`}
          value={color.value}
          onChange={(v) => void onChange((fw) => setColorValue(fw, color.name, "value", v))}
        />
        <div className="flex items-center gap-0.5">
          <span
            className="px-1 text-xs text-muted"
            title={`${used} use${used === 1 ? "" : "s"} on this page`}
          >
            {used}
          </span>
          <button
            type="button"
            aria-label={`${open ? "Close" : "Edit"} options of ${color.name}`}
            aria-expanded={open}
            onClick={onToggle}
            className="rounded-full p-1.5 text-body hover:bg-default"
          >
            <Icon name="ph:sliders-horizontal" width={16} height={16} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${color.name}`}
            onClick={() =>
              used > 0
                ? setConfirming(true)
                : void onChange((fw) => ({ framework: removeColor(fw, color.name) }))
            }
            className="rounded-full p-1.5 text-body hover:bg-danger/10 hover:text-danger"
          >
            <Icon name="ph:trash" width={16} height={16} />
          </button>
        </div>
      </div>
      {nameError ? (
        <p role="alert" className="px-3 pb-2 text-xs text-danger">
          {nameError}
        </p>
      ) : null}
      {confirming ? (
        <div
          role="alertdialog"
          className="mx-2 mb-2 flex items-center gap-2 rounded-2xl bg-danger/10 p-2 text-sm"
        >
          <span className="min-w-0 flex-1">
            {color.name} is used {used} time{used === 1 ? "" : "s"} on this page. Delete it anyway?
          </span>
          <ActionButton size="sm" tone="ghost" onPress={() => setConfirming(false)}>
            Keep
          </ActionButton>
          <ActionButton
            size="sm"
            tone="danger"
            onPress={() => void onChange((fw) => ({ framework: removeColor(fw, color.name) }))}
          >
            Delete
          </ActionButton>
        </div>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {darkMode ? (
            <>
              <OptionSwitch
                label="Enable dark mode"
                tip="Gives this color a second value that the site uses in dark mode. Off: the same color is used in light and dark."
                hint="Use another value when the site is in dark mode."
                selected={color.dark !== undefined}
                onChange={(on) =>
                  void onChange((fw) =>
                    setColorValue(
                      fw,
                      color.name,
                      "dark",
                      on ? (darkVariant(color.value) ?? color.value) : null
                    )
                  )
                }
              />
              {color.dark !== undefined ? (
                <div className="flex items-center gap-2">
                  <ColorField
                    className="flex-1"
                    label={`Dark value of ${color.name}`}
                    value={color.dark}
                    onChange={(v) =>
                      void onChange((fw) => setColorValue(fw, color.name, "dark", v))
                    }
                  />
                  <ActionButton
                    size="sm"
                    tone="outline"
                    onPress={() =>
                      void onChange((fw) =>
                        setColorValue(
                          fw,
                          color.name,
                          "dark",
                          darkVariant(color.value) ?? color.value
                        )
                      )
                    }
                  >
                    Generate again
                  </ActionButton>
                  <InfoTip text="Makes a darker version of the light value again, keeping its hue. Use it after you change the light value." />
                </div>
              ) : null}
            </>
          ) : null}
          <OptionSwitch
            label="Light shades"
            tip="Makes lighter versions of this color, mixed with white, as variables you can use anywhere. Use the number to choose how many (up to 10)."
            hint={`${color.name}-l-1 to -l-${options.lightCount}`}
            selected={options.light}
            onChange={(light) => setOptions({ light })}
            below={
              <ShadeRow
                name={color.name}
                kind="light"
                base={color.value}
                options={options}
                onOverride={override}
              />
            }
          >
            <Stepper
              label="light shades"
              value={options.lightCount}
              min={1}
              max={MAX_SHADES}
              onChange={(lightCount) => setOptions({ lightCount })}
            />
          </OptionSwitch>
          <OptionSwitch
            label="Dark shades"
            tip="Makes darker versions of this color, mixed with black. Use the number to choose how many (up to 10)."
            hint={`${color.name}-d-1 to -d-${options.darkCount}`}
            selected={options.dark}
            onChange={(dark) => setOptions({ dark })}
            below={
              <ShadeRow
                name={color.name}
                kind="dark"
                base={color.value}
                options={options}
                onOverride={override}
              />
            }
          >
            <Stepper
              label="dark shades"
              value={options.darkCount}
              min={1}
              max={MAX_SHADES}
              onChange={(darkCount) => setOptions({ darkCount })}
            />
          </OptionSwitch>
          <OptionSwitch
            label="Transparent shades"
            tip="Makes see-through versions of this color, from faint to nearly solid, for overlays and soft backgrounds. Use the number to choose how many (up to 10)."
            hint={`${color.name}-t-${transparentPercents(options.transparentCount)[0]} to -t-${transparentPercents(options.transparentCount).at(-1)}`}
            selected={options.transparent}
            onChange={(transparent) => setOptions({ transparent })}
            below={
              <ShadeRow
                name={color.name}
                kind="transparent"
                base={color.value}
                options={options}
                onOverride={override}
              />
            }
          >
            <Stepper
              label="transparent shades"
              value={options.transparentCount}
              min={1}
              max={MAX_SHADES}
              onChange={(transparentCount) => setOptions({ transparentCount })}
            />
          </OptionSwitch>
          <div className="max-w-xs">
            <SelectField
              compact
              label="Palette"
              value={color.group}
              options={colorGroups(framework).map((g) => ({ value: g, label: g }))}
              onValueChange={(g) => void onChange((fw) => moveColor(fw, color.name, g))}
            />
          </div>
          <section className="flex flex-col gap-2 rounded-2xl bg-default p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              Utility classes
              <InfoTip text="Makes ready-made classes such as bg-accent or text-accent that set this color on an element. Pick the CSS properties you want classes for." />
            </h4>
            <p className="text-xs text-body">
              Choose the CSS properties to generate classes for, for the color and its enabled
              shades ({shadeCount} shade{shadeCount === 1 ? "" : "s"}). They appear in the framework
              classes.
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Utility class properties"
            >
              {UTILITY_PROPS.map((p) => (
                <button
                  key={p.property}
                  type="button"
                  aria-pressed={options.utility.includes(p.property)}
                  onClick={() => toggleUtility(p.property)}
                  className={
                    "rounded-xl px-2.5 py-1 font-mono text-xs transition-colors duration-300 " +
                    (options.utility.includes(p.property)
                      ? "bg-default-hover text-foreground"
                      : "bg-default-hover text-body hover:bg-default-300")
                  }
                >
                  {p.property}
                </button>
              ))}
            </div>
            {options.utility.length > 0 ? (
              <p className="font-mono text-xs text-body">
                {UTILITY_PROPS.filter((p) => options.utility.includes(p.property))
                  .map((p) => `.${p.prefix}-${color.name}`)
                  .join("  ")}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </li>
  );
}
