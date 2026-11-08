"use client";

import {
  SIDE_SETS,
  hasSides,
  linkValues,
  readSides,
  sidesPatch,
  sidesRelation,
  type ElementNode,
  type FourValues
} from "@nextomic/schema";
import { useState, type ReactNode } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { DynamicBolt } from "./dynamic-bolt";
import { LengthInput } from "./length-input";
import { SettingRow } from "./setting-row";
import { useDesignTarget } from "./use-design-target";
import { VariablePicker } from "./variable-picker";

type Link = "free" | "pairs" | "all";

// The value cells blend into the box: no fill of their own, even while focused; a thin underline
// marks the focused cell instead.
const CELL_FIELD =
  "h-7 w-9 min-w-0 bg-transparent px-0.5 text-center text-small text-foreground outline-none placeholder:text-default-400 focus:shadow-[inset_0_-1px_0_currentColor]";

// The variable and dynamic data buttons of a cell float above it on hover or focus, so the cell
// itself is only the value and its unit and fits between the frame lines.
const CELL_TOOLS =
  "pointer-events-none absolute bottom-full left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full bg-default-200 px-0.5 opacity-0 shadow-small transition-opacity duration-200 " +
  "group-hover/cell:pointer-events-auto group-hover/cell:opacity-100 group-focus-within/cell:pointer-events-auto group-focus-within/cell:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100";

const LINK_LABEL: Record<Link, string> = {
  free: "Each side on its own",
  pairs: "Top and bottom, left and right linked",
  all: "All sides linked"
};

function LinkButton({ link, active, onPick }: { link: Link; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={LINK_LABEL[link]}
      title={LINK_LABEL[link]}
      onClick={onPick}
      className={
        "flex h-6 w-6 items-center justify-center rounded-medium transition-colors duration-300 " +
        (active
          ? "bg-warning/25 text-warning-600"
          : "text-default-500 hover:bg-default-200 hover:text-foreground")
      }
    >
      {link === "free" ? (
        <Icon name="ph:link-simple-break" width={14} height={14} />
      ) : link === "pairs" ? (
        <Icon name="ph:link-simple" width={14} height={14} />
      ) : (
        <Icon name="ph:link" width={14} height={14} />
      )}
    </button>
  );
}

/** Where each cell sits in the box (percent of its width and height). */
const SIDE_POSITION = [
  "left-1/2 top-[9%] -translate-x-1/2",
  "right-[2%] top-1/2 -translate-y-1/2",
  "bottom-[9%] left-1/2 -translate-x-1/2",
  "left-[2%] top-1/2 -translate-y-1/2"
];
const CORNER_POSITION = [
  "left-[3%] top-[8%]",
  "right-[3%] top-[8%]",
  "bottom-[8%] right-[3%]",
  "bottom-[8%] left-[3%]"
];
const SIDE_NAME = ["top", "right", "bottom", "left"];
const CORNER_NAME = ["top left", "top right", "bottom right", "bottom left"];

/** The frame behind the cells: the outer box, the inner box and the four joints between them. */
function BoxFrame() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full text-default-300"
    >
      <rect x="0" y="0" width="100" height="100" rx="6" className="fill-default-100" />
      <rect
        x="30"
        y="28"
        width="40"
        height="44"
        rx="2"
        className="fill-default-50 dark:fill-default-50"
      />
      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <line x1="0" y1="0" x2="30" y2="28" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="70" y2="28" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="100" x2="30" y2="72" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="100" x2="70" y2="72" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

/**
 * Margin, padding, border width, border radius and the position offsets: four values, each on its
 * own, in a box like Figma and Bricks. Three link buttons set how they move together: all sides,
 * top/bottom with left/right, or each side alone.
 */
export function SidesField({
  node,
  setId,
  label,
  tip,
  icon
}: {
  node: ElementNode;
  setId: string;
  label: string;
  tip?: string;
  icon?: ReactNode;
}) {
  const set = SIDE_SETS[setId];
  const target = useDesignTarget(node);
  const apply = useEditorStore((s) => s.setElementStyles);
  const own = set ? readSides(target.ownDeclarations, set) : null;
  const inherited =
    set && target.inheritedDeclarations ? readSides(target.inheritedDeclarations, set) : null;
  const [link, setLink] = useState<Link | null>(null);
  if (!set || !own) return null;

  const corners = set.kind === "corners";
  const names = corners ? CORNER_NAME : SIDE_NAME;
  const mode: Link = link ?? (sidesRelation(own) === "free" ? "free" : sidesRelation(own));
  const changed = hasSides(target.ownDeclarations, set);

  function write(values: FourValues) {
    if (set) apply(node.id, sidesPatch(values, set));
  }

  function pick(next: Link) {
    setLink(next);
    // Linking takes effect at once: the sides snap to the smallest value that is set.
    const linked = linkValues(own as FourValues, next);
    if (linked.some((v, i) => v !== (own as FourValues)[i])) write(linked);
  }

  function edit(index: number, value: string | null) {
    const next: FourValues = [...(own as FourValues)] as FourValues;
    const v = value ?? undefined;
    if (mode === "all") next.fill(v);
    else if (mode === "pairs") {
      next[index] = v;
      next[(index + 2) % 4] = v;
    } else next[index] = v;
    write(next);
  }

  return (
    <SettingRow
      label={label}
      tip={tip}
      icon={icon}
      changed={changed}
      onReset={() => apply(node.id, sidesPatch([undefined, undefined, undefined, undefined], set))}
      responsive
      actions={
        <>
          <div role="group" aria-label={`${label} sides`} className="flex items-center gap-0.5">
            {(["free", "pairs", "all"] as const).map((l) => (
              <LinkButton key={l} link={l} active={mode === l} onPick={() => pick(l)} />
            ))}
          </div>
        </>
      }
    >
      <div
        role="group"
        aria-label={`${label} values`}
        className={"relative w-full " + (corners ? "h-[104px]" : "h-[160px]")}
      >
        {corners ? (
          <div
            aria-hidden
            className="absolute inset-0 rounded-large border border-dashed border-default-300 bg-default-100"
          />
        ) : (
          <BoxFrame />
        )}
        {set.props.map((prop, i) => (
          <div
            key={prop}
            className={
              "group/cell absolute flex items-center " +
              (corners ? CORNER_POSITION[i] : SIDE_POSITION[i])
            }
          >
            <LengthInput
              compact
              property={prop}
              ariaLabel={`${label} ${names[i]}`}
              value={own[i]}
              placeholder={inherited?.[i]}
              onChange={(v) => edit(i, v)}
              fieldClass={CELL_FIELD}
            />
            <div className={CELL_TOOLS}>
              <VariablePicker
                label={`${label} ${names[i]}`}
                property={prop}
                onPick={(ref) => edit(i, ref)}
              />
              <DynamicBolt
                label={`${label} ${names[i]}`}
                onInsert={(token) => edit(i, `${own[i] ?? ""}{{${token}}}`)}
              />
            </div>
          </div>
        ))}
      </div>
    </SettingRow>
  );
}
