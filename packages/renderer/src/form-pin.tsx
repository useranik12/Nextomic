import {
  DEFAULT_MESSAGES,
  PIN_CHARSETS,
  PIN_CHARSET_LABELS,
  PIN_CHARSET_WORDS,
  PIN_LENGTH_MAX,
  PIN_LENGTH_MIN,
  pinCharsetOf,
  pinLengthOf,
  pinPattern
} from "@nextomic/schema";
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
import { registerElement } from "./registry";

// PIN / OTP field (elements.md "Forms"): one box per character, joined into one text value. The
// runtime (`packages/runtime/src/form/pin-cells.ts`) moves focus, takes pasted codes and keeps the
// boxes to the allowed characters; this file draws the boxes and writes the rules.

const FIXED_REASON =
  "The number of boxes and the allowed characters are fixed when the page is saved.";

registerElement({
  type: "pinInput",
  label: "PIN / OTP",
  category: "forms",
  canHaveChildren: false,
  defaults: () => ({
    props: {
      name: "code",
      label: "Verification code",
      length: "6",
      charset: "numeric",
      mask: false,
      placeholder: "",
      value: "",
      required: false,
      helpText: "",
      successMessage: "",
      requiredMessage: DEFAULT_MESSAGES.required,
      lengthMessage: "Enter the full code.",
      patternMessage: "",
      disabled: false
    },
    name: "PIN"
  }),
  propsSchema: z.object({
    name: z.string(),
    label: z.string(),
    length: z.string(),
    charset: z.enum(PIN_CHARSETS),
    mask: looseValue,
    placeholder: z.string(),
    value: looseValue,
    required: looseValue,
    helpText: looseValue,
    successMessage: looseValue,
    requiredMessage: looseValue,
    lengthMessage: looseValue,
    patternMessage: looseValue,
    disabled: looseValue
  }),
  controls: [
    { key: "name", label: "Field name", kind: "text", placeholder: "code", group: GROUP.field },
    {
      key: "length",
      label: `Boxes (${PIN_LENGTH_MIN} to ${PIN_LENGTH_MAX})`,
      kind: "text",
      placeholder: "6",
      group: GROUP.field
    },
    {
      key: "charset",
      label: "Allowed characters",
      kind: "select",
      options: PIN_CHARSETS.map((value) => ({ value, label: PIN_CHARSET_LABELS[value] })),
      group: GROUP.field
    },
    { key: "label", label: "Label", kind: "text", group: GROUP.content },
    { key: "placeholder", label: "Empty box character", kind: "text", group: GROUP.content },
    { key: "value", label: "Default value", kind: "text", group: GROUP.content },
    { key: "helpText", label: "Help text", kind: "text", group: GROUP.content },
    { key: "required", label: "Required", kind: "switch", group: GROUP.validation },
    ...messageControlsFor([
      { key: "requiredMessage", label: "Required message", message: "required" }
    ]),
    {
      key: "lengthMessage",
      label: "Incomplete message",
      kind: "text",
      placeholder: "Enter the full code.",
      group: GROUP.messages
    },
    {
      key: "patternMessage",
      label: "Wrong character message",
      kind: "text",
      placeholder: PIN_CHARSET_WORDS.numeric,
      group: GROUP.messages
    },
    { key: "successMessage", label: "Success message", kind: "text", group: GROUP.messages },
    { key: "mask", label: "Hide characters", kind: "switch", group: GROUP.behavior },
    { key: "disabled", label: "Disabled", kind: "switch", group: GROUP.behavior }
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    label: true,
    length: { reason: FIXED_REASON },
    charset: { reason: FIXED_REASON },
    mask: true,
    placeholder: { reason: "One fixed character drawn in an empty box, not data." },
    value: true,
    required: true,
    helpText: true,
    successMessage: true,
    requiredMessage: true,
    lengthMessage: true,
    patternMessage: true,
    disabled: true
  },
  render: (ctx) => {
    const { node, attrs } = ctx;
    const name = ctx.text("name");
    const length = pinLengthOf(ctx.text("length"));
    const charset = pinCharsetOf(node.props.charset);
    const controlId = `${attrs.id ?? attrs["data-nid"] ?? name}-control`;
    const labelId = `${controlId}-label`;
    const notes = fieldNotes(ctx, { help: `${controlId}-help`, error: `${controlId}-error` });
    const label = ctx.text("label");
    const required = on(ctx, "required");
    const mask = on(ctx, "mask");
    const disabled = on(ctx, "disabled");
    const chars = [...ctx.text("value")];
    const hint = [...ctx.text("placeholder")][0];
    const pattern = pinPattern(charset);
    const messages: Record<string, string> = {};
    const requiredText = ctx.text("requiredMessage");
    if (requiredText) messages.required = requiredText;
    messages.length = ctx.text("lengthMessage") || "Enter the full code.";
    const patternText = ctx.text("patternMessage") || PIN_CHARSET_WORDS[charset];
    if (patternText) messages.pattern = patternText;
    const boxes = Array.from({ length }, (_, i) =>
      createElement("input", {
        // A new starting character remounts the box; React keeps what an input shows once mounted.
        key: `${i}:${chars[i] ?? ""}`,
        id: i === 0 ? controlId : `${controlId}-${i + 1}`,
        type: mask ? "password" : "text",
        inputMode: charset === "numeric" ? "numeric" : "text",
        autoComplete: i === 0 ? "one-time-code" : "off",
        autoCapitalize: "off",
        spellCheck: false,
        defaultValue: chars[i] ?? "",
        placeholder: hint,
        disabled: disabled || undefined,
        "aria-label": `${label || name}, character ${i + 1} of ${length}`,
        "aria-describedby": notes.describedBy,
        "data-nxt-control": "",
        "data-nxt-cell": "",
        "data-filled": chars[i] ? "" : undefined
      })
    );
    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-field": name,
        "data-nxt-kind": "pin",
        "data-nxt-charset": charset,
        "data-nxt-rules": JSON.stringify({
          type: "text",
          required,
          minLength: length,
          maxLength: length,
          pattern,
          messages
        })
      },
      label
        ? createElement(
            "label",
            { id: labelId, htmlFor: controlId, "data-required": flag(required) },
            label
          )
        : null,
      createElement(
        "div",
        {
          role: "group",
          "aria-labelledby": label ? labelId : undefined,
          "aria-required": required || undefined,
          "data-nxt-cells": ""
        },
        boxes
      ),
      ...notes.nodes
    );
  }
});
