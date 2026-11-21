"use client";

import { ColorField } from "@/components/ui/color-field";
import { InfoTip } from "@/components/ui/info-tip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SwitchField as Switch } from "@/components/ui/toggles";
import {
  flipInverted,
  invertedRef,
  isInverted,
  plainRef,
  resolveRenderTheme
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { buildPalettes, rampSwatches, resolveColor, type Swatch } from "./color-ramps";
import { ColorShades } from "./color-shades";
import { CHECKER, ColorSwatch } from "./color-swatch";
import { useStylePreview } from "./design-field-tools";
import { useDesignVariables } from "./use-design-variables";

/**
 * The color field's palette button: choose a palette from a dropdown (the groups of the colors in
 * the Colors manager) and pick from its colors, each shown as a ramp with its darker and lighter
 * shades. With dark mode on in the theme, colors that have a dark value are split in two (light
 * left, dark right) and the Inverse switch uses the color the other way round: the dark value in
 * light mode and the light value in dark mode. Hovering a swatch shows it on the element; a pick
 * stores the variable so the color follows the design system.
 */
export function ColorPalette({
  label,
  property,
  value,
  onPick
}: {
  label: string;
  property: string;
  value: string | undefined;
  onPick: (next: string | null) => void;
}) {
  const variables = useDesignVariables();
  const preview = useStylePreview(property);
  const themes = useEditorStore((s) => s.project.themes);
  const theme = useMemo(
    () => resolveRenderTheme(themes, { pageId: "", route: "/" }).theme,
    [themes]
  );
  const dual = theme?.darkMode ?? false;
  const framework = theme?.framework ?? null;
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Swatch | null>(null);
  const [inverse, setInverse] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const palettes = useMemo(() => buildPalettes(variables, dual), [variables, dual]);
  const plain = value === undefined ? undefined : plainRef(value);
  const owner = palettes.find(([, ramps]) =>
    ramps.some((r) => rampSwatches(r).some((s) => s.value === plain))
  );
  const name = chosen ?? owner?.[0] ?? palettes[0]?.[0] ?? "";
  const ramps = palettes.find(([g]) => g === name)?.[1] ?? [];
  const selected =
    palettes.flatMap(([, rs]) => rs.flatMap(rampSwatches)).find((s) => s.value === plain) ?? null;
  const active =
    ramps.find((r) => r.base.key === activeKey) ??
    ramps.find((r) => rampSwatches(r).some((s) => s.value === plain)) ??
    null;
  const inverted = value !== undefined && isInverted(value);
  const shown = resolveColor(plain, variables, inverted ? "dark" : "light");
  const footer = hovered ?? selected;
  const inverseOff = !dual || (selected !== null && selected.darkColor === undefined);

  const storedFor = (s: Swatch, flip = inverse) =>
    flip && s.darkColor !== undefined ? invertedRef(s.value) : s.value;

  function close() {
    preview.clear();
    setHovered(null);
    setMenu(false);
    setOpen(false);
  }

  function pick(next: string | null) {
    onPick(next);
    close();
  }

  /** A color or shade is applied at once and the popover stays open for the next one. */
  function apply(s: Swatch) {
    onPick(storedFor(s));
  }

  function hover(s: Swatch | null) {
    setHovered(s);
    if (!s) return preview.clear();
    const stored = storedFor(s);
    preview.show(isInverted(stored) ? flipInverted(stored, framework) : stored);
  }

  function toggleInverse(on: boolean) {
    setInverse(on);
    if (selected?.darkColor !== undefined) onPick(storedFor(selected, on));
  }

  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => {
        if (next) {
          setInverse(inverted);
          setOpen(true);
        } else close();
      }}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`Color palette for ${label}`}
          title={inverted ? "Color palette (inverse)" : "Color palette"}
          className="relative flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-muted transition-colors duration-300 hover:bg-default-300 hover:text-foreground"
        >
          {shown ? (
            <span
              className={
                "block h-4 w-4 overflow-hidden rounded-full border border-default-400 " + CHECKER
              }
            >
              <span aria-hidden style={{ background: shown }} className="block h-full w-full" />
            </span>
          ) : (
            <Icon name="ph:palette" width={14} height={14} />
          )}
          {inverted ? (
            <Icon
              name="ph:moon"
              width={9}
              height={9}
              className="absolute -right-0.5 -top-0.5 rounded-full bg-surface text-foreground"
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[296px] items-stretch gap-3 rounded-2xl p-3">
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
            className="flex h-9 w-full items-center justify-between rounded-xl bg-default px-3 text-sm font-medium transition-colors hover:bg-default-hover"
          >
            <span className="flex items-center gap-2">
              <span className="text-xs font-normal text-muted">Color palette</span>
              {name}
            </span>
            <Icon
              name="ph:caret-down"
              width={14}
              height={14}
              className={menu ? "rotate-180" : ""}
            />
          </button>
          {menu ? (
            <ul
              role="listbox"
              aria-label="Color palettes"
              className="absolute inset-x-0 top-10 z-10 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
            >
              {palettes.map(([g, list]) => (
                <li key={g} role="option" aria-selected={g === name}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(g);
                      setActiveKey(null);
                      setMenu(false);
                    }}
                    className={
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors " +
                      (g === name
                        ? "bg-warning/20 font-medium text-warning-700 dark:text-warning"
                        : "hover:bg-default")
                    }
                  >
                    {g}
                    <span className="text-xs text-muted">{list.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {ramps.length === 0 ? (
          <p className="text-xs text-muted">
            No theme colors yet. Add them in Design System, Colors, or type a custom color below.
          </p>
        ) : null}
        <ul
          aria-label={`${name} colors`}
          className="grid max-h-44 grid-cols-7 gap-1.5 overflow-x-hidden overflow-y-auto p-0.5"
        >
          {ramps.map((r) => {
            const hasShades = r.darker.length + r.lighter.length + r.clear.length > 0;
            return (
              <li key={r.base.key} className="relative">
                <ColorSwatch
                  swatch={r.base}
                  selected={r.base.value === plain}
                  inverse={inverse}
                  onPick={() => {
                    setActiveKey(r.base.key);
                    apply(r.base);
                  }}
                  onEnter={() => hover(r.base)}
                  onLeave={() => hover(null)}
                  className="aspect-square w-full"
                />
                {hasShades ? (
                  <span
                    aria-hidden
                    title="Has shades"
                    className="pointer-events-none absolute bottom-0.5 right-0.5 size-1.5 rounded-full bg-white shadow ring-1 ring-black/50"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        {active ? (
          <ColorShades
            ramp={active}
            value={plain}
            inverse={inverse}
            onPick={apply}
            onHover={hover}
          />
        ) : null}

        <p className="flex min-h-5 items-center justify-between gap-2 text-xs" aria-live="polite">
          <span className="truncate font-medium">
            {footer?.name ?? (value ? "Custom color" : "No color set")}
          </span>
          <span className="shrink-0 font-mono text-muted">
            {footer
              ? footer.darkColor
                ? `${footer.color} · ${footer.darkColor}`
                : footer.color
              : (shown ?? "")}
          </span>
        </p>

        {dual ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-default px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Icon name="ph:moon" width={14} height={14} />
              Inverse
              <InfoTip
                text={
                  inverseOff && selected !== null
                    ? "This color has the same value in light and dark mode, so there is nothing to invert. Turn on dark mode for it in Design System, Colors."
                    : "Uses the color the other way round on this element: its dark value in light mode and its light value in dark mode. Good for a section with a reversed design."
                }
              />
            </p>
            <Switch
              size="sm"
              isSelected={inverse}
              isDisabled={inverseOff}
              onValueChange={toggleInverse}
              aria-label="Inverse color"
            />
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <ColorField
            className="min-w-0 flex-1"
            label="Custom color"
            value={plain ?? ""}
            display={shown}
            onChange={(v) => onPick(v)}
          />
          {value ? (
            <button
              type="button"
              onClick={() => pick(null)}
              className="h-8 rounded-full bg-default px-3 text-xs font-medium transition-colors hover:bg-default-hover"
            >
              Clear
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
