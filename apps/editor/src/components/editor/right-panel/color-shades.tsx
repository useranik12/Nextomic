"use client";

import type { Ramp, Swatch } from "./color-ramps";
import { ColorSwatch } from "./color-swatch";

/**
 * The child colors of a color: its darker, lighter and see-through shades, each set on its own
 * labelled row of fixed size swatches. With no shades it says how to get some.
 */
export function ColorShades({
  ramp,
  value,
  inverse,
  onPick,
  onHover
}: {
  ramp: Ramp;
  /** The plain reference of the color in use. */
  value: string | undefined;
  inverse: boolean;
  onPick: (s: Swatch) => void;
  onHover: (s: Swatch | null) => void;
}) {
  const rows = [
    { id: "darker", label: "Darker", list: ramp.darker },
    { id: "lighter", label: "Lighter", list: ramp.lighter },
    { id: "clear", label: "See-through", list: ramp.clear }
  ].filter((r) => r.list.length > 0);
  return (
    <section
      aria-label={`Shades of ${ramp.base.name}`}
      className="flex flex-col gap-2 rounded-xl bg-default p-2.5"
    >
      <h4 className="truncate text-xs font-semibold">
        Shades of <span className="font-mono font-medium">{ramp.base.name}</span>
      </h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">
          No shades yet. Turn on Light, Dark or Transparent shades for this color in Design System,
          Colors.
        </p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="flex items-start gap-2">
            <span className="w-[4.25rem] shrink-0 pt-2 text-[11px] text-muted">{r.label}</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 p-0.5">
              {r.list.map((s) => (
                <ColorSwatch
                  key={s.key}
                  swatch={s}
                  selected={s.value === value}
                  inverse={inverse}
                  onPick={() => onPick(s)}
                  onEnter={() => onHover(s)}
                  onLeave={() => onHover(null)}
                  className="size-7"
                />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
