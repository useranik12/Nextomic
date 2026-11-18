import { DEFAULT_MESSAGES, numberSpecOf, numberText } from "@nextomic/schema";
import { createElement } from "react";
import { z } from "zod";
import { iconInner, iconWrapper } from "./elements";
import {
  FORM_NAME_REASON,
  GROUP,
  fieldNotes,
  looseValue,
  messageControlsFor,
  on
} from "./field-parts";
import { registerElement } from "./registry";

// Count Controller (elements.md "Forms"): a minus button, the count and a plus button, like the
// FlutterFlow widget. The count is one number held inside its limits. The runtime
// (`packages/runtime/src/form/number-field.ts`) runs the buttons and keys; this file draws the
// parts and sets the starting state (a button is disabled at its limit).

const ICON_LIBRARY_REASON =
  "Only the icon name is dynamic; the library decides which icon sets a page loads.";

registerElement({
  type: "counter",
  label: "Count Controller",
  category: "forms",
  canHaveChildren: false,
  defaults: () => ({
    props: {
      name: "count",
      label: "",
      value: "0",
      step: "1",
      min: "",
      max: "",
      decLibrary: "",
      decIcon: "",
      incLibrary: "",
      incIcon: "",
      helpText: "",
      successMessage: "",
      rangeMessage: DEFAULT_MESSAGES.range,
      disabled: false
    },
    name: "Counter"
  }),
  propsSchema: z.object({
    name: z.string(),
    label: looseValue,
    value: looseValue,
    step: looseValue,
    min: looseValue,
    max: looseValue,
    decLibrary: z.string().optional(),
    decIcon: looseValue,
    incLibrary: z.string().optional(),
    incIcon: looseValue,
    helpText: looseValue,
    successMessage: looseValue,
    rangeMessage: looseValue,
    disabled: looseValue
  }),
  controls: [
    { key: "name", label: "Field name", kind: "text", placeholder: "quantity", group: GROUP.field },
    { key: "label", label: "Label", kind: "text", group: GROUP.content },
    { key: "value", label: "Initial count", kind: "text", placeholder: "0", group: GROUP.content },
    { key: "step", label: "Step size", kind: "text", placeholder: "1", group: GROUP.content },
    { key: "min", label: "Minimum", kind: "text", group: GROUP.content },
    { key: "max", label: "Maximum", kind: "text", group: GROUP.content },
    { key: "helpText", label: "Help text", kind: "text", group: GROUP.content },
    {
      key: "decIcon",
      label: "Decrease icon",
      kind: "icon",
      libraryKey: "decLibrary",
      group: GROUP.icons
    },
    {
      key: "incIcon",
      label: "Increase icon",
      kind: "icon",
      libraryKey: "incLibrary",
      group: GROUP.icons
    },
    ...messageControlsFor([{ key: "rangeMessage", label: "Range message", message: "range" }]),
    { key: "successMessage", label: "Success message", kind: "text", group: GROUP.messages },
    { key: "disabled", label: "Disabled", kind: "switch", group: GROUP.behavior }
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    label: true,
    value: true,
    step: true,
    min: true,
    max: true,
    decLibrary: { reason: ICON_LIBRARY_REASON },
    decIcon: true,
    incLibrary: { reason: ICON_LIBRARY_REASON },
    incIcon: true,
    helpText: true,
    successMessage: true,
    rangeMessage: true,
    disabled: true
  },
  render: (ctx) => {
    const { attrs } = ctx;
    const name = ctx.text("name");
    const spec = numberSpecOf(ctx.text);
    const controlId = `${attrs.id ?? attrs["data-nid"] ?? name}-control`;
    const notes = fieldNotes(ctx, { help: `${controlId}-help`, error: `${controlId}-error` });
    const label = ctx.text("label");
    const disabled = on(ctx, "disabled");
    const range = ctx.text("rangeMessage");
    const button = (direction: -1 | 1, libraryKey: string, iconKey: string, glyph: string) => {
      const icon = ctx.text(iconKey);
      const drawn = icon ? ctx.icon(ctx.text(libraryKey), icon, { size: "1em", label: "" }) : null;
      const atLimit =
        direction < 0
          ? spec.min !== null && spec.start <= spec.min
          : spec.max !== null && spec.start >= spec.max;
      return createElement(
        "button",
        {
          type: "button",
          tabIndex: -1,
          disabled: disabled || atLimit || undefined,
          "aria-label": direction < 0 ? "Decrease" : "Increase",
          "aria-controls": controlId,
          "data-nxt-step": String(direction)
        },
        drawn === null ? glyph : iconWrapper({}, "", iconInner(drawn))
      );
    };
    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-field": name,
        "data-nxt-kind": "number",
        "data-nxt-min": spec.min ?? undefined,
        "data-nxt-max": spec.max ?? undefined,
        "data-nxt-step-size": spec.step,
        "data-nxt-rules": JSON.stringify({
          type: "number",
          required: false,
          min: spec.min,
          max: spec.max,
          messages: range ? { range } : {}
        })
      },
      label ? createElement("label", { htmlFor: controlId }, label) : null,
      createElement(
        "div",
        { role: "group", "aria-label": label || name, "data-nxt-counter": "" },
        button(-1, "decLibrary", "decIcon", "−"),
        createElement("input", {
          // A new starting count remounts the input; React keeps what an input shows once it is mounted.
          key: numberText(spec.start),
          id: controlId,
          type: "text",
          readOnly: true,
          inputMode: "decimal",
          role: "spinbutton",
          "aria-valuemin": spec.min ?? undefined,
          "aria-valuemax": spec.max ?? undefined,
          "aria-valuenow": spec.start,
          "aria-describedby": notes.describedBy,
          defaultValue: numberText(spec.start),
          disabled: disabled || undefined,
          "data-nxt-control": "",
          "data-nxt-count": ""
        }),
        button(1, "incLibrary", "incIcon", "+")
      ),
      ...notes.nodes
    );
  }
});
