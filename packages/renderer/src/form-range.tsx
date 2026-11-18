import { DEFAULT_MESSAGES, numberSpecOf, numberText } from "@nextomic/schema";
import { createElement, type CSSProperties } from "react";
import { z } from "zod";
import {
  FORM_NAME_REASON,
  GROUP,
  fieldNotes,
  looseValue,
  messageControlsFor,
  on
} from "./field-parts";
import { registerElement } from "./registry";

// Range slider (elements.md "Forms"): one thumb on a track between a minimum and a maximum. The
// track, fill and thumb are plain elements so every part can be designed; a real range input lies
// invisible over them and gives the native keyboard and screen reader behavior. The runtime
// (`packages/runtime/src/form/number-field.ts`) keeps the fill and the value readout in step.

const SHOW_VALUES = ["none", "bubble", "end"] as const;

registerElement({
  type: "rangeSlider",
  label: "Range Slider",
  category: "forms",
  canHaveChildren: false,
  defaults: () => ({
    props: {
      name: "level",
      label: "Level",
      value: "50",
      min: "0",
      max: "100",
      step: "1",
      showValue: "bubble",
      prefix: "",
      suffix: "",
      showLimits: false,
      helpText: "",
      successMessage: "",
      rangeMessage: DEFAULT_MESSAGES.range,
      disabled: false
    },
    name: "Range"
  }),
  propsSchema: z.object({
    name: z.string(),
    label: looseValue,
    value: looseValue,
    min: looseValue,
    max: looseValue,
    step: looseValue,
    showValue: z.enum(SHOW_VALUES),
    prefix: looseValue,
    suffix: looseValue,
    showLimits: looseValue,
    helpText: looseValue,
    successMessage: looseValue,
    rangeMessage: looseValue,
    disabled: looseValue
  }),
  controls: [
    { key: "name", label: "Field name", kind: "text", placeholder: "volume", group: GROUP.field },
    { key: "label", label: "Label", kind: "text", group: GROUP.content },
    { key: "value", label: "Initial value", kind: "text", placeholder: "50", group: GROUP.content },
    { key: "min", label: "Minimum", kind: "text", placeholder: "0", group: GROUP.content },
    { key: "max", label: "Maximum", kind: "text", placeholder: "100", group: GROUP.content },
    { key: "step", label: "Step size", kind: "text", placeholder: "1", group: GROUP.content },
    {
      key: "showValue",
      label: "Show value",
      kind: "select",
      options: [
        { value: "none", label: "Hidden" },
        { value: "bubble", label: "Above the thumb" },
        { value: "end", label: "At the end" }
      ],
      group: GROUP.content
    },
    { key: "prefix", label: "Value prefix", kind: "text", placeholder: "$", group: GROUP.content },
    { key: "suffix", label: "Value suffix", kind: "text", placeholder: "%", group: GROUP.content },
    { key: "showLimits", label: "Show min and max", kind: "switch", group: GROUP.content },
    { key: "helpText", label: "Help text", kind: "text", group: GROUP.content },
    ...messageControlsFor([{ key: "rangeMessage", label: "Range message", message: "range" }]),
    { key: "successMessage", label: "Success message", kind: "text", group: GROUP.messages },
    { key: "disabled", label: "Disabled", kind: "switch", group: GROUP.behavior }
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    label: true,
    value: true,
    min: true,
    max: true,
    step: true,
    showValue: { reason: "A fixed layout choice, not data." },
    prefix: true,
    suffix: true,
    showLimits: true,
    helpText: true,
    successMessage: true,
    rangeMessage: true,
    disabled: true
  },
  render: (ctx) => {
    const { node, attrs } = ctx;
    const name = ctx.text("name");
    const spec = numberSpecOf(ctx.text);
    // A slider needs both ends; the save check reports a missing one, the page falls back to 0..100.
    const min = spec.min ?? 0;
    const max = spec.max ?? Math.max(100, min + spec.step);
    const start = Math.min(Math.max(spec.start, min), max);
    const controlId = `${attrs.id ?? attrs["data-nid"] ?? name}-control`;
    const notes = fieldNotes(ctx, { help: `${controlId}-help`, error: `${controlId}-error` });
    const label = ctx.text("label");
    const disabled = on(ctx, "disabled");
    const range = ctx.text("rangeMessage");
    const showValue = SHOW_VALUES.find((v) => v === node.props.showValue) ?? "bubble";
    const prefix = ctx.text("prefix");
    const suffix = ctx.text("suffix");
    const shown = `${prefix}${numberText(start)}${suffix}`;
    const readout = (key: string) =>
      createElement(
        "output",
        {
          key,
          htmlFor: controlId,
          "data-nxt-value": "",
          "data-prefix": prefix || undefined,
          "data-suffix": suffix || undefined
        },
        shown
      );
    const fraction = max === min ? 0 : (start - min) / (max - min);
    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-field": name,
        "data-nxt-kind": "number",
        "data-nxt-min": min,
        "data-nxt-max": max,
        "data-nxt-step-size": spec.step,
        "data-nxt-rules": JSON.stringify({
          type: "number",
          required: false,
          min,
          max,
          messages: range ? { range } : {}
        })
      },
      label ? createElement("label", { htmlFor: controlId }, label) : null,
      createElement(
        "div",
        { "data-nxt-range": "", style: { "--nxt-p": String(fraction) } as CSSProperties },
        on(ctx, "showLimits")
          ? createElement("span", { key: "min", "data-nxt-limit": "min" }, numberText(min))
          : null,
        createElement(
          "div",
          { "data-nxt-slide": "" },
          createElement("span", { "data-nxt-track": "", "aria-hidden": "true" }),
          createElement("span", { "data-nxt-fill": "", "aria-hidden": "true" }),
          createElement(
            "span",
            { "data-nxt-thumb": "", "aria-hidden": "true" },
            showValue === "bubble" ? readout("bubble") : null
          ),
          createElement("input", {
            // A new starting value remounts the input; React keeps what a mounted input shows.
            key: numberText(start),
            id: controlId,
            type: "range",
            min,
            max,
            step: spec.step,
            defaultValue: numberText(start),
            disabled: disabled || undefined,
            "aria-valuetext": showValue === "none" ? undefined : shown,
            "aria-describedby": notes.describedBy,
            "data-nxt-control": ""
          })
        ),
        on(ctx, "showLimits")
          ? createElement("span", { key: "max", "data-nxt-limit": "max" }, numberText(max))
          : null,
        showValue === "end" ? readout("end") : null
      ),
      ...notes.nodes
    );
  }
});
