"use client";

import { ANIMATION_PROPERTY_PATTERN } from "@nextomic/schema";
import { useState } from "react";
import { FormInput, SelectField } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";

type Values = Record<string, string | number>;

interface Preset {
  name: string;
  tip: string;
  start: string | number;
}

// What people animate most. Anything else can be typed in as a custom property.
const PRESETS: Preset[] = [
  { name: "opacity", tip: "Transparency: 0 is invisible, 1 is fully visible.", start: 0 },
  { name: "x", tip: "Move sideways in pixels. Negative moves left.", start: 40 },
  { name: "y", tip: "Move up or down in pixels. Negative moves up.", start: 40 },
  {
    name: "xPercent",
    tip: "Move sideways as a percentage of the element's own width.",
    start: 100
  },
  {
    name: "yPercent",
    tip: "Move up or down as a percentage of the element's own height.",
    start: 100
  },
  { name: "scale", tip: "Size multiplier: 1 is normal, 0.5 is half, 2 is double.", start: 0.8 },
  { name: "scaleX", tip: "Width multiplier only.", start: 0 },
  { name: "scaleY", tip: "Height multiplier only.", start: 0 },
  { name: "rotation", tip: "Turn in degrees. 360 is one full turn.", start: 90 },
  { name: "skewX", tip: "Slant sideways in degrees.", start: 10 },
  { name: "skewY", tip: "Slant vertically in degrees.", start: 10 },
  { name: "width", tip: "Width, such as 200 or 50%.", start: "100%" },
  { name: "height", tip: "Height, such as 200 or 50%.", start: "100%" },
  { name: "backgroundColor", tip: "Background colour, such as #ff0000.", start: "#ff0000" },
  { name: "color", tip: "Text colour, such as #ffffff.", start: "#ffffff" },
  { name: "borderRadius", tip: "Corner roundness, such as 12 or 50%.", start: 12 },
  { name: "rotationX", tip: "Tilt forward or back in 3D, in degrees.", start: 45 },
  { name: "rotationY", tip: "Turn around the vertical axis in 3D, in degrees.", start: 45 }
];

const CUSTOM = "__custom";

function PropertyRow({
  name,
  value,
  onChange,
  onRemove
}: {
  name: string;
  value: string | number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const preset = PRESETS.find((p) => p.name === name);
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <span className="mb-1 flex items-center gap-1.5 text-tiny font-medium text-default-600">
          {name}
          <InfoTip
            text={
              preset?.tip ?? "A custom GSAP property. Use a number or text such as 50% or #fff."
            }
            label={name}
          />
        </span>
        <FormInput
          compact
          aria-label={`${name} value`}
          value={String(value)}
          onValueChange={onChange}
        />
      </div>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        className="mb-1 rounded p-1 text-default-500 hover:text-danger"
      >
        <Icon name="ph:trash" width={14} height={14} />
      </button>
    </div>
  );
}

/** The list of properties an animation changes, with an "add" picker for the common ones. */
export function PropertyEditor({
  title,
  tip,
  values,
  onChange
}: {
  title: string;
  tip: string;
  values: Values;
  onChange: (next: Values) => void;
}) {
  const [custom, setCustom] = useState("");
  const free = PRESETS.filter((p) => !(p.name in values));
  const customValid = ANIMATION_PROPERTY_PATTERN.test(custom) && !(custom in values);

  const add = (name: string, start: string | number) => onChange({ ...values, [name]: start });
  const remove = (name: string) => {
    const { [name]: _removed, ...rest } = values;
    onChange(rest);
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wide text-default-500">
        {title}
        <InfoTip text={tip} label={title} />
      </span>
      {Object.entries(values).map(([name, value]) => (
        <PropertyRow
          key={name}
          name={name}
          value={value}
          onChange={(next) => onChange({ ...values, [name]: next })}
          onRemove={() => remove(name)}
        />
      ))}
      {Object.keys(values).length === 0 ? (
        <p className="text-small text-default-500">No properties yet. Add one below.</p>
      ) : null}
      <SelectField
        compact
        hideLabel
        label={`Add a property to ${title}`}
        value={CUSTOM}
        options={[
          { value: CUSTOM, label: "Add a property…" },
          ...free.map((p) => ({ value: p.name, label: p.name }))
        ]}
        onValueChange={(name) => {
          const preset = PRESETS.find((p) => p.name === name);
          if (preset) add(preset.name, preset.start);
        }}
      />
      <div className="flex items-center gap-2">
        <FormInput
          compact
          aria-label="Custom property name"
          placeholder="Custom, e.g. letterSpacing"
          value={custom}
          onValueChange={setCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customValid) {
              add(custom, 0);
              setCustom("");
            }
          }}
        />
        <button
          type="button"
          disabled={!customValid}
          onClick={() => {
            add(custom, 0);
            setCustom("");
          }}
          className="rounded-full bg-default-100 px-3 py-1.5 text-tiny font-medium hover:bg-default-200 disabled:opacity-40"
        >
          Add
        </button>
        <InfoTip
          text="Any property GSAP can animate, in camelCase: letterSpacing, boxShadow, clipPath, and so on."
          label="Custom property"
        />
      </div>
    </div>
  );
}
