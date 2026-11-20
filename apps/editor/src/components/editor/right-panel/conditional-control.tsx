"use client";

import {
  isConditionalValue,
  type ConditionalValue,
  type ElementNode,
  type PropValue
} from "@nextomic/schema";
import { getElementDefinition, type ControlDef } from "@nextomic/renderer";
import { useRef, useState, type ReactNode } from "react";
import { ADORNMENT_BUTTON } from "@/components/ui/floating-adornments";
import { Hint } from "@/components/ui/hint";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { ConditionalPopover } from "./conditional-popover";
import { conditionalSummary, startConditional, type ValueKind } from "./conditional-value";

/** Whether a control may hold a conditional value: it has the bolt (a written opt-out has neither). */
export function canBeConditional(node: ElementNode, control: ControlDef): boolean {
  if (control.key === "htmlTag" || control.kind === "icon") return false;
  return getElementDefinition(node.type)?.bindable[control.key] === true;
}

export const valueKindOf = (control: ControlDef): ValueKind =>
  control.kind === "switch" ? "switch" : control.kind === "select" ? "select" : "text";

export interface ConditionalControl {
  /** The conditional value of the prop, or null while it is static or bolt text. */
  value: ConditionalValue | null;
  /** The condition icon button for the adornments row. */
  button: ReactNode;
  /** Marks the element the panel sits beside (spread on the field box). */
  anchorKey: string;
  /** A read-only summary chip that opens the popover (for a conditional prop). */
  chip: ReactNode;
  /** The open popover, if any. */
  popover: ReactNode;
}

/**
 * The conditional value of one prop: the condition icon, the summary chip and the popover. Choosing
 * Conditional replaces the written value (the written value becomes Else; undo restores it).
 */
export function useConditionalControl(node: ElementNode, control: ControlDef): ConditionalControl {
  const setProp = useEditorStore((s) => s.setElementProp);
  const raw: PropValue | undefined = node.props[control.key];
  const value = isConditionalValue(raw) ? raw : null;
  const kind = valueKindOf(control);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const anchorKey = `${node.id}:${control.key}`;

  // Opening only shows the panel. The value is saved once it passes the safety check.
  const toggle = () => setOpen((now) => !now);

  const iconButton = (
    <Hint content="Conditional value: choose the value by conditions">
      <button
        ref={button}
        type="button"
        data-conditional-icon
        data-cond-icon-key={anchorKey}
        aria-label={`Conditional value for ${control.label}`}
        aria-pressed={value !== null}
        onClick={toggle}
        className={
          ADORNMENT_BUTTON +
          " hover:bg-default-hover " +
          (value ? "text-accent" : "text-subtle hover:text-foreground")
        }
      >
        <Icon name="ph:git-fork" width={14} height={14} />
      </button>
    </Hint>
  );

  const chip = value ? (
    <button
      type="button"
      data-conditional-chip
      data-cond-anchor={anchorKey}
      data-cond-icon-key={anchorKey}
      aria-label={`Conditional value for ${control.label}: ${conditionalSummary(value, kind)}`}
      onClick={toggle}
      className="flex min-h-8 w-full items-center gap-2 rounded-full bg-default px-3 text-left text-xs text-foreground transition-colors duration-300 hover:bg-default-hover"
    >
      <Icon name="ph:git-fork" width={14} height={14} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate">{conditionalSummary(value, kind)}</span>
    </button>
  ) : null;

  const popover = open ? (
    <ConditionalPopover
      node={node}
      propKey={control.key}
      label={control.label}
      kind={kind}
      options={(control.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
      initial={value ?? startConditional(raw, kind)}
      anchorKey={anchorKey}
      onCommit={(next) => setProp(node.id, control.key, next)}
      onFixed={(next) => setProp(node.id, control.key, next)}
      onClose={() => setOpen(false)}
    />
  ) : null;

  return { value, button: iconButton, chip, popover, anchorKey };
}
