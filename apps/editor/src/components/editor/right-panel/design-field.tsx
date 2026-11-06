"use client";

import { builtinStyle } from "@nextomic/renderer";
import type { ElementNode } from "@nextomic/schema";
import { useId } from "react";
import { SelectField } from "@/components/ui/controls";
import { WEIGHT_NAMES } from "../design-system/fonts/font-model";
import { useEditorStore } from "../store/editor-store";
import { ColorPalette } from "./color-palette";
import { fieldKind } from "./design-field-tools";
import type { DesignProperty } from "./design-groups";
import { CallEditorButton } from "./call-editor";
import { DesignIcon, PropertyIcon } from "./design-icons";
import { DynamicBolt } from "./dynamic-bolt";
import { FontPicker } from "./font-picker";
import { LengthInput } from "./length-input";
import { unitSpecFor } from "./length-units";
import { SettingRow, bareFieldClass, fieldShellClass } from "./setting-row";
import { SidesField } from "./sides-field";
import { useDesignTarget } from "./use-design-target";
import { useFontSupport } from "./use-font-support";
import { VariablePicker, typesForProperty } from "./variable-picker";

// HeroUI Select keys cannot be empty, so "no value set" has its own key.
const DEFAULT_OPTION = "__default";

const STANDARD_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

const weightLabel = (w: number): string => `${w}${WEIGHT_NAMES[w] ? ` (${WEIGHT_NAMES[w]})` : ""}`;

/** The options a property offers; font weight and style follow the font that is in use. */
function useOptions(node: ElementNode, property: DesignProperty, own: string | undefined) {
  const support = useFontSupport(node);
  if (property.fontOption === "weight") {
    const weights = support ? support.weights : STANDARD_WEIGHTS;
    const list =
      own && !weights.includes(Number(own)) && Number(own) ? [...weights, Number(own)] : weights;
    return {
      hidden: false,
      options: [...new Set(list)]
        .sort((a, b) => a - b)
        .map((w) => ({ value: String(w), label: weightLabel(w) }))
    };
  }
  if (property.fontOption === "style") {
    // A font without an italic face cannot draw italic, so the setting is not offered.
    if (support && !support.italic && (own === undefined || own === "normal")) {
      return { hidden: true, options: [] };
    }
    const styles = support
      ? support.italic
        ? ["normal", "italic"]
        : ["normal"]
      : (property.options ?? []);
    const list = own && !styles.includes(own) ? [...styles, own] : styles;
    return { hidden: false, options: list.map((o) => ({ value: o, label: o })) };
  }
  return { hidden: false, options: (property.options ?? []).map((o) => ({ value: o, label: o })) };
}

export function DesignField({ node, property }: { node: ElementNode; property: DesignProperty }) {
  const id = useId();
  const target = useDesignTarget(node);
  const setStyle = useEditorStore((s) => s.setElementStyle);
  const { options, hidden } = useOptions(node, property, target.own(property.property));
  if (property.sides) {
    return (
      <SidesField
        node={node}
        setId={property.sides}
        label={property.label}
        tip={property.tip}
        icon={<PropertyIcon property={property.property} />}
      />
    );
  }
  if (hidden) return null;

  const own = target.own(property.property);
  // Dimmed hint of the value inherited from the base breakpoint.
  const inherited = target.inherited(property.property);
  const changed = own !== undefined;
  // What the element looks like before anything is set here (a container starts as a flex column).
  const builtin = builtinStyle(node, property.property);
  const effective = own ?? inherited ?? builtin;
  const kind = fieldKind(property.property);
  const numeric = unitSpecFor(property.property) !== null;
  const set = (next: string | null) => setStyle(node.id, property.property, next);

  return (
    <SettingRow
      label={property.label}
      htmlFor={id}
      changed={changed}
      onReset={() => set(null)}
      tip={property.tip}
      responsive={!property.half}
      icon={<PropertyIcon property={property.property} />}
    >
      {property.options && property.icons ? (
        <div
          role="group"
          aria-label={property.label}
          className="grid grid-flow-col auto-cols-fr gap-1"
        >
          {property.options.map((o) => (
            <button
              key={o}
              type="button"
              title={o}
              aria-label={o}
              aria-pressed={own === o}
              data-effective={own === undefined && effective === o ? "true" : undefined}
              onClick={() => set(own === o ? null : o)}
              className={
                "flex h-10 items-center justify-center rounded-medium outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-default-800/50 " +
                (own === o
                  ? "bg-default-300 text-foreground"
                  : effective === o
                    ? "bg-default-200 text-foreground ring-1 ring-inset ring-default-400"
                    : "bg-default-100 text-default-600 hover:bg-default-200")
              }
            >
              <DesignIcon id={property.icons?.[o] ?? ""} />
            </button>
          ))}
        </div>
      ) : property.options ? (
        <SelectField
          compact
          hideLabel
          label={property.label}
          value={own ?? DEFAULT_OPTION}
          options={[
            {
              value: DEFAULT_OPTION,
              label: inherited
                ? `${inherited} (inherited)`
                : builtin
                  ? `${builtin} (default)`
                  : "Default"
            },
            ...options
          ]}
          onValueChange={(next) => set(next === DEFAULT_OPTION ? null : next)}
        />
      ) : (
        <div className={fieldShellClass}>
          {numeric ? (
            <div className="min-w-0 flex-1">
              <LengthInput
                id={id}
                property={property.property}
                ariaLabel={property.label}
                value={own}
                placeholder={inherited ?? builtin ?? property.placeholder}
                onChange={set}
                fieldClass={bareFieldClass}
              />
            </div>
          ) : (
            <input
              id={id}
              value={own ?? ""}
              placeholder={inherited ?? builtin ?? property.placeholder}
              onChange={(e) => set(e.target.value.trim() === "" ? null : e.target.value)}
              className={bareFieldClass}
            />
          )}
          <div className="flex h-9 shrink-0 items-center gap-0.5 pr-1">
            {kind === "color" ? (
              <ColorPalette
                label={property.label}
                property={property.property}
                value={own}
                onPick={set}
              />
            ) : null}
            {kind === "font" ? <FontPicker property={property.property} onPick={set} /> : null}
            {kind !== "color" && typesForProperty(property.property) !== null ? (
              <VariablePicker label={property.label} property={property.property} onPick={set} />
            ) : null}
            {property.editor ? (
              <CallEditorButton
                label={property.label}
                kind={property.editor}
                value={own}
                onChange={set}
              />
            ) : null}
            {property.half ? null : (
              <DynamicBolt
                label={property.label}
                onInsert={() => undefined}
                disabledReason="Dynamic style values arrive with the dynamic data phase."
              />
            )}
          </div>
        </div>
      )}
    </SettingRow>
  );
}
