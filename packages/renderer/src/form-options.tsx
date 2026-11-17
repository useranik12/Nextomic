import { DEFAULT_MESSAGES, valueKindOf } from "@nextomic/schema";
import { createElement } from "react";
import { z } from "zod";
import { iconInner, iconWrapper } from "./elements";
import {
  FORM_NAME_REASON,
  GROUP,
  fieldNotes,
  flag,
  looseValue,
  messageControlsFor,
  numberOrNull,
  on
} from "./field-parts";
import { registerElement, type ControlDef, type RenderContext } from "./registry";

// Options and the fields that hold them (elements.md "Forms"): Radio, Checkbox group and Choice
// chips. The options are child elements, so a query loop on the field repeats them and every option
// prop takes dynamic data. Radio and single-choice chips keep one text value; the others a list.

const ICON_REASON =
  "Only the icon name is dynamic; the library decides which icon sets a page loads.";

/** The input an option draws, from the field it sits in (a Radio and single-choice chips use radios). */
function optionInput(ctx: RenderContext) {
  const field = ctx.parent;
  const many = field ? valueKindOf(field.node) === "many" : true;
  return {
    type: many ? "checkbox" : "radio",
    name: field?.text("name") || undefined,
    disabled: field?.text("disabled") === "true"
  };
}

function renderOption(ctx: RenderContext) {
  const group = optionInput(ctx);
  const label = ctx.text("label");
  const subtext = ctx.text("subtext");
  const slot = (library: string, icon: string) => {
    const name = ctx.text(icon);
    const drawn = name ? ctx.icon(ctx.text(library), name, { size: "1em", label: "" }) : null;
    return drawn === null ? null : iconWrapper({ "data-nxt-ico": "" }, "", iconInner(drawn));
  };
  return createElement(
    "label",
    { ...ctx.attrs, "data-nxt-choice": "" },
    createElement("input", {
      type: group.type,
      name: group.name,
      value: ctx.text("value") || label,
      defaultChecked: on(ctx, "selected") || undefined,
      disabled: group.disabled || on(ctx, "disabled") || undefined,
      "data-nxt-control": ""
    }),
    createElement("span", { "data-nxt-mark": "", "aria-hidden": "true" }),
    slot("library", "icon"),
    createElement(
      "span",
      { "data-nxt-text": "" },
      label,
      subtext ? createElement("span", { "data-nxt-sub": "" }, subtext) : null
    ),
    slot("endLibrary", "endIcon")
  );
}

registerElement({
  type: "option",
  label: "Option",
  category: "forms",
  canHaveChildren: false,
  defaults: () => ({
    props: {
      label: "Option",
      subtext: "",
      value: "",
      selected: false,
      disabled: false,
      library: "",
      icon: "",
      endLibrary: "",
      endIcon: ""
    },
    name: "Option"
  }),
  propsSchema: z.object({
    label: looseValue,
    subtext: looseValue,
    value: looseValue,
    selected: looseValue,
    disabled: looseValue,
    library: z.string().optional(),
    icon: looseValue,
    endLibrary: z.string().optional(),
    endIcon: looseValue
  }),
  controls: [
    { key: "label", label: "Label", kind: "text", group: GROUP.content },
    { key: "subtext", label: "Subtext", kind: "text", group: GROUP.content },
    {
      key: "value",
      label: "Value",
      kind: "text",
      placeholder: "Same as the label",
      group: GROUP.content
    },
    { key: "selected", label: "Chosen at start", kind: "switch", group: GROUP.content },
    { key: "icon", label: "Icon before", kind: "icon", libraryKey: "library", group: GROUP.icons },
    {
      key: "endIcon",
      label: "Icon after",
      kind: "icon",
      libraryKey: "endLibrary",
      group: GROUP.icons
    },
    { key: "disabled", label: "Disabled", kind: "switch", group: GROUP.behavior }
  ],
  bindable: {
    label: true,
    subtext: true,
    value: true,
    selected: true,
    disabled: true,
    library: { reason: ICON_REASON },
    icon: true,
    endLibrary: { reason: ICON_REASON },
    endIcon: true
  },
  render: renderOption
});

type GroupType = "radio" | "checkboxGroup" | "choiceChips";

const LAYOUTS = [
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" }
];

const starterOptions = () =>
  [1, 2, 3].map((n) => ({
    type: "option",
    name: `Option ${n}`,
    props: { label: `Option ${n}`, value: `option${n}` }
  }));

const text = (key: string, label: string, group: string): ControlDef => ({
  key,
  label,
  kind: "text",
  group
});
const toggle = (key: string, label: string, group: string): ControlDef => ({
  key,
  label,
  kind: "switch",
  group
});

function registerGroup(type: GroupType, label: string, defaultName: string) {
  const chips = type === "choiceChips";
  // Radio holds one value; the other two count what was chosen when they hold several.
  const counts = type !== "radio";
  registerElement({
    type,
    label,
    category: "forms",
    canHaveChildren: true,
    defaults: () => ({
      props: {
        name: defaultName,
        label: "Label",
        layout: chips ? "horizontal" : "vertical",
        ...(chips ? { multiple: true } : {}),
        required: false,
        minSelected: "",
        maxSelected: "",
        helpText: "",
        successMessage: "",
        requiredMessage: DEFAULT_MESSAGES.required,
        selectionMessage: DEFAULT_MESSAGES.selection,
        disabled: false
      },
      name: label
    }),
    starterChildren: starterOptions,
    propsSchema: z.object({
      name: z.string(),
      label: looseValue,
      layout: z.enum(["vertical", "horizontal"]),
      ...(chips ? { multiple: looseValue } : {}),
      required: looseValue,
      minSelected: looseValue,
      maxSelected: looseValue,
      helpText: looseValue,
      successMessage: looseValue,
      requiredMessage: looseValue,
      selectionMessage: looseValue,
      disabled: looseValue
    }),
    controls: [
      {
        key: "name",
        label: "Field name",
        kind: "text",
        placeholder: defaultName,
        group: GROUP.field
      },
      text("label", "Label", GROUP.content),
      text("helpText", "Help text", GROUP.content),
      { key: "layout", label: "Layout", kind: "select", options: LAYOUTS, group: GROUP.content },
      ...(chips ? [toggle("multiple", "Choose several", GROUP.options)] : []),
      toggle("required", "Required", GROUP.validation),
      ...(counts
        ? [
            text("minSelected", "Fewest chosen", GROUP.validation),
            text("maxSelected", "Most chosen", GROUP.validation)
          ]
        : []),
      ...messageControlsFor([
        { key: "requiredMessage", label: "Required message", message: "required" },
        ...(counts
          ? [{ key: "selectionMessage", label: "Count message", message: "selection" as const }]
          : [])
      ]),
      text("successMessage", "Success message", GROUP.messages),
      toggle("disabled", "Disabled", GROUP.behavior)
    ],
    bindable: {
      name: { reason: FORM_NAME_REASON },
      label: true,
      layout: { reason: "A fixed layout choice, not data." },
      ...(chips
        ? {
            multiple: {
              reason:
                "Whether one or several options can be chosen decides how the value is kept, so it is fixed when the page is saved."
            }
          }
        : {}),
      required: true,
      minSelected: true,
      maxSelected: true,
      helpText: true,
      successMessage: true,
      requiredMessage: true,
      selectionMessage: true,
      disabled: true
    },
    render: (ctx) => {
      const { attrs, node } = ctx;
      const name = ctx.text("name");
      const many = valueKindOf(node) === "many";
      const base = `${attrs.id ?? attrs["data-nid"] ?? name}`;
      const labelId = `${base}-label`;
      const notes = fieldNotes(ctx, { help: `${base}-help`, error: `${base}-error` });
      const required = on(ctx, "required");
      const title = ctx.text("label");
      const messages: Record<string, string> = {};
      if (ctx.text("requiredMessage")) messages.required = ctx.text("requiredMessage");
      if (ctx.text("selectionMessage")) messages.selection = ctx.text("selectionMessage");
      return createElement(
        "div",
        {
          ...attrs,
          role: many ? "group" : "radiogroup",
          "aria-labelledby": title ? labelId : undefined,
          "aria-describedby": notes.describedBy,
          "aria-required": required || undefined,
          "data-nxt-field": name,
          "data-nxt-kind": many ? "many" : "one",
          "data-nxt-variant": chips ? "chips" : undefined,
          "data-nxt-rules": JSON.stringify({
            kind: many ? "many" : "text",
            type: "text",
            required,
            minSelected: many ? numberOrNull(ctx.text("minSelected")) : null,
            maxSelected: many ? numberOrNull(ctx.text("maxSelected")) : null,
            messages
          })
        },
        title
          ? createElement(
              "span",
              { id: labelId, "data-nxt-label": "", "data-required": flag(required) },
              title
            )
          : null,
        createElement(
          "div",
          { "data-nxt-options": "", "data-nxt-layout": ctx.text("layout") || "vertical" },
          ctx.children
        ),
        ...notes.nodes
      );
    }
  });
}

registerGroup("radio", "Radio", "choice");
registerGroup("checkboxGroup", "Checkbox group", "choices");
registerGroup("choiceChips", "Choice chips", "tags");
