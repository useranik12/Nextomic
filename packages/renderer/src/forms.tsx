import {
  DEFAULT_MESSAGES,
  FORM_STATUSES,
  INPUT_TYPES,
  VALIDATE_ON,
  VALIDATE_ON_LABELS,
  patternProblem,
  type InputType
} from "@nextomic/schema";
import { createElement } from "react";
import { z } from "zod";
import { registerElement, type ControlDef, type RenderContext } from "./registry";

// Form wrapper and Input (elements.md "Forms"). The wrapper has no action flow; the runtime reads
// the data-nxt-* attributes written here to keep field values, show errors and answer Form actions.

const FORM_NAME_REASON =
  "Form and field names are identifiers the Form tags and actions refer to; they must be known when the page is saved.";

const numberOrNull = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** A switch prop is on when its text, after dynamic data resolves, is `true`. */
const on = (ctx: RenderContext, key: string): boolean => ctx.text(key) === "true";

const flag = (value: boolean): "true" | undefined => (value ? "true" : undefined);

registerElement({
  type: "form",
  label: "Form",
  category: "forms",
  canHaveChildren: true,
  defaults: () => ({
    props: { name: "form", status: "active", validateOn: "blurThenChange" },
    name: "Form"
  }),
  propsSchema: z.object({
    name: z.string(),
    status: z.enum(FORM_STATUSES),
    validateOn: z.enum(VALIDATE_ON)
  }),
  controls: [
    { key: "name", label: "Form name", kind: "text", placeholder: "signupForm" },
    {
      key: "status",
      label: "Status",
      kind: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" }
      ]
    },
    {
      key: "validateOn",
      label: "Validate on",
      kind: "select",
      options: VALIDATE_ON.map((value) => ({ value, label: VALIDATE_ON_LABELS[value] }))
    }
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    status: {
      reason:
        "Whether a form is active decides which actions and tags exist, so it is fixed when the page is saved."
    },
    validateOn: {
      reason: "The validation moment is fixed per form so every field behaves the same way."
    }
  },
  render: ({ node, attrs, text, children }) =>
    createElement(
      "form",
      {
        ...attrs,
        noValidate: true,
        "data-nxt-form": text("name"),
        "data-nxt-validate-on": text("validateOn") || "blurThenChange",
        "data-nxt-inactive": flag(node.props.status === "inactive")
      },
      children
    )
});

// Static text, a number or a switch; dynamic text is checked by the shared prop value schema.
const looseValue = z.union([z.string(), z.number(), z.boolean()]).optional();

const INPUT_TYPE_OPTIONS = INPUT_TYPES.map((value) => ({ value, label: value, icon: value }));

const GROUP = {
  field: "Field",
  content: "Content",
  validation: "Validation",
  messages: "Messages",
  behavior: "Behavior"
} as const;

const messageControls: ControlDef[] = (
  [
    { key: "requiredMessage", label: "Required message", message: "required" },
    { key: "typeMessage", label: "Format message", message: "type" },
    { key: "lengthMessage", label: "Length message", message: "length" },
    { key: "rangeMessage", label: "Range message", message: "range" },
    { key: "patternMessage", label: "Pattern message", message: "pattern" },
    { key: "matchMessage", label: "Match message", message: "match" }
  ] satisfies { key: string; label: string; message: keyof typeof DEFAULT_MESSAGES }[]
).map(({ key, label, message }) => ({
  key,
  label,
  kind: "text",
  group: GROUP.messages,
  placeholder: DEFAULT_MESSAGES[message]
}));

const MESSAGE_PROPS = [
  ["required", "requiredMessage"],
  ["type", "typeMessage"],
  ["length", "lengthMessage"],
  ["range", "rangeMessage"],
  ["pattern", "patternMessage"],
  ["match", "matchMessage"]
] as const;

function inputRules(ctx: RenderContext, type: InputType) {
  const pattern = ctx.text("pattern");
  const messages: Record<string, string> = {};
  for (const [key, prop] of MESSAGE_PROPS) {
    const message = ctx.text(prop);
    if (message) messages[key] = message;
  }
  return {
    type,
    required: on(ctx, "required"),
    minLength: numberOrNull(ctx.text("minLength")),
    maxLength: numberOrNull(ctx.text("maxLength")),
    min: numberOrNull(ctx.text("min")),
    max: numberOrNull(ctx.text("max")),
    pattern: pattern && !patternProblem(pattern) ? pattern : "",
    matchField: ctx.text("matchField"),
    messages
  };
}

registerElement({
  type: "input",
  label: "Input",
  category: "forms",
  canHaveChildren: false,
  defaults: () => ({
    props: {
      name: "field",
      type: "text",
      label: "Label",
      placeholder: "",
      value: "",
      required: false,
      minLength: "",
      maxLength: "",
      min: "",
      max: "",
      pattern: "",
      matchField: "",
      requiredMessage: DEFAULT_MESSAGES.required,
      typeMessage: DEFAULT_MESSAGES.type,
      lengthMessage: DEFAULT_MESSAGES.length,
      rangeMessage: DEFAULT_MESSAGES.range,
      patternMessage: DEFAULT_MESSAGES.pattern,
      matchMessage: DEFAULT_MESSAGES.match,
      disabled: false,
      readOnly: false,
      clearable: false,
      showToggle: false
    },
    name: "Input"
  }),
  propsSchema: z.object({
    name: z.string(),
    type: z.enum(INPUT_TYPES),
    label: z.string(),
    placeholder: z.string(),
    value: looseValue,
    required: looseValue,
    minLength: looseValue,
    maxLength: looseValue,
    min: looseValue,
    max: looseValue,
    pattern: looseValue,
    matchField: z.string(),
    requiredMessage: looseValue,
    typeMessage: looseValue,
    lengthMessage: looseValue,
    rangeMessage: looseValue,
    patternMessage: looseValue,
    matchMessage: looseValue,
    disabled: looseValue,
    readOnly: looseValue,
    clearable: looseValue,
    showToggle: looseValue
  }),
  controls: [
    { key: "name", label: "Field name", kind: "text", placeholder: "email", group: GROUP.field },
    { key: "type", label: "Type", kind: "select", options: INPUT_TYPE_OPTIONS, group: GROUP.field },
    { key: "label", label: "Label", kind: "text", group: GROUP.content },
    { key: "placeholder", label: "Placeholder", kind: "text", group: GROUP.content },
    { key: "value", label: "Default value", kind: "text", group: GROUP.content },
    { key: "required", label: "Required", kind: "switch", group: GROUP.validation },
    { key: "minLength", label: "Minimum length", kind: "text", group: GROUP.validation },
    { key: "maxLength", label: "Maximum length", kind: "text", group: GROUP.validation },
    { key: "min", label: "Minimum value", kind: "text", group: GROUP.validation },
    { key: "max", label: "Maximum value", kind: "text", group: GROUP.validation },
    {
      key: "pattern",
      label: "Regex pattern",
      kind: "text",
      placeholder: "^[a-z]+$",
      group: GROUP.validation
    },
    {
      key: "matchField",
      label: "Must match field",
      kind: "text",
      placeholder: "password",
      group: GROUP.validation
    },
    ...messageControls,
    { key: "disabled", label: "Disabled", kind: "switch", group: GROUP.behavior },
    { key: "readOnly", label: "Read only", kind: "switch", group: GROUP.behavior },
    { key: "clearable", label: "Clear button", kind: "switch", group: GROUP.behavior },
    {
      key: "showToggle",
      label: "Show/hide password button",
      kind: "switch",
      group: GROUP.behavior
    }
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    type: {
      reason:
        "A dynamic type could turn a password field into plain text, so the type is fixed when the page is saved."
    },
    label: true,
    placeholder: true,
    value: true,
    required: true,
    minLength: true,
    maxLength: true,
    min: true,
    max: true,
    pattern: true,
    matchField: { reason: FORM_NAME_REASON },
    requiredMessage: true,
    typeMessage: true,
    lengthMessage: true,
    rangeMessage: true,
    patternMessage: true,
    matchMessage: true,
    disabled: true,
    readOnly: true,
    clearable: true,
    showToggle: true
  },
  render: (ctx) => {
    const { node, attrs } = ctx;
    const type = INPUT_TYPES.find((t) => t === node.props.type) ?? "text";
    const name = ctx.text("name");
    const controlId = `${attrs.id ?? attrs["data-nid"] ?? name}-control`;
    const errorId = `${controlId}-error`;
    const password = type === "password";
    const controlProps = {
      id: controlId,
      name,
      placeholder: ctx.text("placeholder") || undefined,
      required: on(ctx, "required") || undefined,
      disabled: on(ctx, "disabled") || undefined,
      readOnly: on(ctx, "readOnly") || undefined,
      minLength: numberOrNull(ctx.text("minLength")) ?? undefined,
      maxLength: numberOrNull(ctx.text("maxLength")) ?? undefined,
      "aria-describedby": errorId,
      "data-nxt-control": ""
    };
    // A password field never carries a default value (it would sit in the HTML and the state).
    const value = password ? undefined : ctx.text("value");
    const control =
      type === "textarea"
        ? createElement("textarea", { ...controlProps, defaultValue: value })
        : createElement("input", {
            ...controlProps,
            type,
            defaultValue: value,
            min: type === "number" ? (numberOrNull(ctx.text("min")) ?? undefined) : undefined,
            max: type === "number" ? (numberOrNull(ctx.text("max")) ?? undefined) : undefined,
            autoComplete: password ? "current-password" : undefined
          });
    const label = ctx.text("label");
    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-field": name,
        "data-nxt-secret": password ? "" : undefined,
        "data-nxt-rules": JSON.stringify(inputRules(ctx, type))
      },
      label ? createElement("label", { htmlFor: controlId }, label) : null,
      createElement(
        "div",
        { "data-nxt-box": "" },
        control,
        on(ctx, "clearable")
          ? createElement(
              "button",
              { type: "button", hidden: true, "data-nxt-clear": "", "aria-label": "Clear field" },
              "×"
            )
          : null,
        password && on(ctx, "showToggle")
          ? createElement(
              "button",
              {
                type: "button",
                "data-nxt-toggle": "",
                "aria-label": "Show password",
                "aria-pressed": "false"
              },
              "Show"
            )
          : null
      ),
      createElement("p", { id: errorId, role: "alert", hidden: true, "data-nxt-error": "" })
    );
  }
});
