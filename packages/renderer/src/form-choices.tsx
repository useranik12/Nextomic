import { DEFAULT_MESSAGES } from "@nextomic/schema";
import { createElement } from "react";
import { z } from "zod";
import {
  FORM_NAME_REASON,
  GROUP,
  fieldNotes,
  flag,
  looseValue,
  messageControlsFor,
  on
} from "./field-parts";
import { registerElement, type RenderContext } from "./registry";

// Choice fields (elements.md "Forms"): Checkbox first; Radio, Checkbox group and Choice chips share
// the same parts (`data-nxt-choice` row, `data-nxt-mark` box) and the same runtime shapes.

const requiredMessage = (ctx: RenderContext): Record<string, string> => {
  const text = ctx.text("requiredMessage");
  return text ? { required: text } : {};
};

registerElement({
  type: "checkbox",
  label: "Checkbox",
  category: "forms",
  canHaveChildren: false,
  defaults: () => ({
    props: {
      name: "agree",
      label: "I agree",
      subtext: "",
      checked: false,
      required: false,
      helpText: "",
      successMessage: "",
      requiredMessage: DEFAULT_MESSAGES.required,
      disabled: false
    },
    name: "Checkbox"
  }),
  propsSchema: z.object({
    name: z.string(),
    label: z.string(),
    subtext: looseValue,
    checked: looseValue,
    required: looseValue,
    helpText: looseValue,
    successMessage: looseValue,
    requiredMessage: looseValue,
    disabled: looseValue
  }),
  controls: [
    { key: "name", label: "Field name", kind: "text", placeholder: "agree", group: GROUP.field },
    { key: "label", label: "Label", kind: "text", group: GROUP.content },
    { key: "subtext", label: "Subtext", kind: "text", group: GROUP.content },
    { key: "helpText", label: "Help text", kind: "text", group: GROUP.content },
    { key: "checked", label: "Checked at start", kind: "switch", group: GROUP.content },
    { key: "required", label: "Must be checked", kind: "switch", group: GROUP.validation },
    ...messageControlsFor([
      { key: "requiredMessage", label: "Required message", message: "required" }
    ]),
    { key: "successMessage", label: "Success message", kind: "text", group: GROUP.messages },
    { key: "disabled", label: "Disabled", kind: "switch", group: GROUP.behavior }
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    label: true,
    subtext: true,
    checked: true,
    required: true,
    helpText: true,
    successMessage: true,
    requiredMessage: true,
    disabled: true
  },
  render: (ctx) => {
    const { attrs } = ctx;
    const name = ctx.text("name");
    const controlId = `${attrs.id ?? attrs["data-nid"] ?? name}-control`;
    const notes = fieldNotes(ctx, { help: `${controlId}-help`, error: `${controlId}-error` });
    const required = on(ctx, "required");
    const label = ctx.text("label");
    const subtext = ctx.text("subtext");
    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-field": name,
        "data-nxt-kind": "check",
        "data-nxt-rules": JSON.stringify({
          kind: "check",
          type: "text",
          required,
          messages: requiredMessage(ctx)
        })
      },
      createElement(
        "label",
        { htmlFor: controlId, "data-nxt-choice": "", "data-required": flag(required) },
        createElement("input", {
          id: controlId,
          type: "checkbox",
          name,
          defaultChecked: on(ctx, "checked") || undefined,
          required: required || undefined,
          disabled: on(ctx, "disabled") || undefined,
          "aria-describedby": notes.describedBy,
          "data-nxt-control": ""
        }),
        createElement("span", { "data-nxt-mark": "", "aria-hidden": "true" }),
        createElement(
          "span",
          { "data-nxt-text": "" },
          label,
          subtext ? createElement("span", { "data-nxt-sub": "" }, subtext) : null
        )
      ),
      ...notes.nodes
    );
  }
});
