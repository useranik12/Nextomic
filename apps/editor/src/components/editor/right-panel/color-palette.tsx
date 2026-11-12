"use client";

import { ColorField } from "@/components/ui/color-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { previewProps, useStylePreview } from "./design-field-tools";
import { useDesignVariables, type DesignVariable } from "./use-design-variables";

interface Swatch {
  key: string;
  name: string;
  /** The color shown. */
  color: string;
  /** What gets stored when picked: a `var(--nxt-name)` reference, or the raw color. */
  value: string;
}

// Shown as the "Utility" palette until the project makes one of its own.
const UTILITY: [string, string][] = [
  ["White", "#f5f5f5"],
  ["Light gray", "#9a9a9a"],
  ["Gray", "#6b6b6b"],
  ["Black", "#050505"],
  ["Charcoal", "#1b1b1b"],
  ["Green", "#16a34a"],
  ["Red", "#e5121c"],
  ["Amber", "#eaa90c"],
  ["Blue", "#0a6cff"],
  ["Mint", "#e8fff0"],
  ["Rose", "#ffecec"],
  ["Cream", "#fff3d6"],
  ["Sky", "#e7f0ff"],
  ["Violet", "#3d0a7a"],
  ["Pink", "#f5224f"]
];

const INNER = /var\(\s*(--[a-z][a-z0-9-]*)\s*\)/gi;

/**
 * The color a value shows: a plain color as is, a `var(--name)` looked up in the project and theme
 * framework variables. References inside color-mix() and friends are resolved too.
 */
export function resolveColor(
  value: string | undefined,
  variables: readonly DesignVariable[],
  depth = 0
): string | null {
  if (!value) return null;
  const text = value.trim();
  if (depth > 6) return null;
  if (!text.includes("var(")) return text;
  let failed = false;
  const out = text.replace(INNER, (_m, name: string) => {
    const found = variables.find((v) => v.cssName === name);
    const color = found ? resolveColor(found.value, variables, depth + 1) : null;
    if (color === null) failed = true;
    return color ?? "transparent";
  });
  return failed ? null : out;
}

const CHECKER =
  "bg-[conic-gradient(#d4d4d8_25%,#fff_0_50%,#d4d4d8_0_75%,#fff_0)] bg-[length:8px_8px]";

/**
 * The color field's palette button, like Bricks: choose a palette from a dropdown (the groups of
 * the project's color variables) and pick from a grid of swatches. Hovering a swatch shows it on
 * the element; a pick stores the variable so the color follows the design system.
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
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Swatch | null>(null);

  const palettes = useMemo(() => {
    const map = new Map<string, Swatch[]>();
    for (const v of variables) {
      if (v.type !== "color") continue;
      const list = map.get(v.group) ?? [];
      list.push({
        key: v.key,
        name: v.name,
        color: resolveColor(v.ref, variables) ?? v.value,
        value: v.ref
      });
      map.set(v.group, list);
    }
    if (!map.has("Utility"))
      map.set(
        "Utility",
        UTILITY.map(([name, color]) => ({ key: color, name, color, value: color }))
      );
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [variables]);

  const owner = palettes.find(([, list]) => list.some((s) => s.value === value));
  const name = chosen ?? owner?.[0] ?? palettes[0]?.[0] ?? "";
  const swatches = palettes.find(([g]) => g === name)?.[1] ?? [];
  const shown = resolveColor(value, variables);
  const footer = hovered ?? swatches.find((s) => s.value === value) ?? null;

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

  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`Color palette for ${label}`}
          title="Color palette"
          className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-muted transition-colors duration-300 hover:bg-default-300 hover:text-foreground"
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

        <ul aria-label={`${name} colors`} className="grid grid-cols-7 gap-1.5">
          {swatches.map((s) => {
            const selected = s.value === value;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  title={`${s.name} ${s.color}`}
                  aria-label={`${s.name} ${s.color}`}
                  aria-pressed={selected}
                  onClick={() => pick(s.value)}
                  {...previewProps(preview, s.value)}
                  onMouseEnter={() => {
                    preview.show(s.value);
                    setHovered(s);
                  }}
                  onMouseLeave={() => {
                    preview.clear();
                    setHovered(null);
                  }}
                  className={
                    "relative block aspect-square w-full overflow-hidden rounded-lg border border-black/10 transition-transform hover:z-[1] hover:scale-110 focus-visible:ring-1 focus-visible:ring-focus/30 dark:border-white/15 " +
                    CHECKER +
                    (selected ? " ring-1 ring-focus/30 dark:ring-default-700" : "")
                  }
                >
                  <span aria-hidden style={{ background: s.color }} className="absolute inset-0" />
                  {selected ? (
                    <Icon
                      name="ph:check"
                      width={12}
                      height={12}
                      className="absolute inset-0 m-auto text-white mix-blend-difference"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="flex min-h-5 items-center justify-between gap-2 text-xs" aria-live="polite">
          <span className="truncate font-medium">
            {footer?.name ?? (value ? "Custom color" : "No color set")}
          </span>
          <span className="shrink-0 font-mono text-muted">{footer?.color ?? shown ?? ""}</span>
        </p>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <ColorField
            className="min-w-0 flex-1"
            label="Custom color"
            value={value ?? ""}
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
