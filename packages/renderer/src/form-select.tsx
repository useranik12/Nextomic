import {
  DEFAULT_COUNT_TEXT,
  DEFAULT_MESSAGES,
  OPTIONS_SOURCES,
  OPTION_VALUE_TYPES,
  SELECT_DISPLAYS,
  STATE_TYPE_LABELS,
  countText,
  isMultiple,
  maxChipsOf,
  optionValueTypeOf,
  selectDisplayOf,
  startChoices,
  valueKindOf,
  type StartChoice
} from "@nextomic/schema";
import { createElement, type ReactNode } from "react";
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

// Select (docs/elements.md "Select"): a field that opens a searchable list of options. The options
// are child Option elements (the Radio, Checkbox group and Choice chips model), drawn as rows of a
// listbox in a popover, each with its hidden real input, so the value shapes (one, many), validation
// and the form tags need nothing new. `packages/runtime/src/form/select-field.ts` opens the popover,
// filters the rows, moves the active row and repaints the closed field.

const ICON_REASON =
  "Only the icon name is dynamic; the library decides which icon sets a page loads.";
const FIXED_REASON = "A fixed layout choice, not data.";

const CHEVRON = ["M6 9l6 6 6-6"];

/** A small built-in line icon, used until the author picks a library icon. */
const glyph = (paths: string[]): ReactNode =>
  createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: "1em",
      height: "1em",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      focusable: "false"
    },
    ...paths.map((d) => createElement("path", { key: d, d }))
  );

const starterOptions = () =>
  [1, 2, 3].map((n) => ({
    type: "option",
    name: `Option ${n}`,
    props: { label: `Option ${n}`, value: `option${n}` }
  }));

/** The closed field's content for the options chosen at the start (the runtime repaints it later). */
function closedContent(
  chosen: StartChoice[],
  multiple: boolean,
  display: (typeof SELECT_DISPLAYS)[number],
  maxChips: number,
  countTemplate: string,
  placeholder: string
): ReactNode[] {
  if (chosen.length === 0)
    return [createElement("span", { key: "empty", "data-nxt-placeholder": "" }, placeholder)];
  if (!multiple)
    return [createElement("span", { key: "value", "data-nxt-value": "" }, chosen[0]?.label)];
  if (display === "text")
    return [
      createElement(
        "span",
        { key: "value", "data-nxt-value": "" },
        chosen.map((c) => c.label).join(", ")
      )
    ];
  if (display === "count")
    return [
      createElement(
        "span",
        { key: "value", "data-nxt-value": "" },
        countText(countTemplate, chosen.length)
      )
    ];
  const shown = chosen.slice(0, maxChips);
  const rest = chosen.length - shown.length;
  return [
    createElement(
      "span",
      { key: "chips", "data-nxt-values": "" },
      ...shown.map((c) =>
        createElement(
          "span",
          { key: c.value, "data-nxt-chip": "", "data-v": c.value },
          createElement("span", { "data-nxt-chip-label": "" }, c.label),
          createElement("span", { "data-nxt-chip-x": "", "aria-hidden": "true" }, "×")
        )
      ),
      rest > 0 ? createElement("span", { key: "more", "data-nxt-more": "" }, `+${rest}`) : null
    )
  ];
}

const text = (key: string, label: string, group: string, placeholder?: string): ControlDef => ({
  key,
  label,
  kind: "text",
  group,
  ...(placeholder ? { placeholder } : {})
});
const toggle = (key: string, label: string, group: string): ControlDef => ({
  key,
  label,
  kind: "switch",
  group
});

registerElement({
  type: "select",
  label: "Select",
  category: "forms",
  canHaveChildren: true,
  defaults: () => ({
    props: {
      name: "choice",
      label: "Select",
      placeholder: "Choose an option",
      helpText: "",
      multiple: false,
      searchable: true,
      searchPlaceholder: "Search",
      noResultsText: "No matches found",
      clearable: true,
      display: "chips",
      maxChips: "3",
      countText: DEFAULT_COUNT_TEXT,
      keepOpen: true,
      optionsSource: "static",
      valueType: "string",
      required: false,
      minSelected: "",
      maxSelected: "",
      requiredMessage: DEFAULT_MESSAGES.required,
      selectionMessage: DEFAULT_MESSAGES.selection,
      successMessage: "",
      iconLibrary: "",
      icon: "",
      caretLibrary: "",
      caretIcon: "",
      clearLibrary: "",
      clearIcon: "",
      disabled: false
    },
    name: "Select"
  }),
  starterChildren: starterOptions,
  propsSchema: z.object({
    name: z.string(),
    label: looseValue,
    placeholder: looseValue,
    helpText: looseValue,
    multiple: looseValue,
    searchable: looseValue,
    searchPlaceholder: looseValue,
    noResultsText: looseValue,
    clearable: looseValue,
    display: z.enum(SELECT_DISPLAYS),
    maxChips: z.string(),
    countText: looseValue,
    keepOpen: looseValue,
    optionsSource: z.enum(OPTIONS_SOURCES),
    valueType: z.enum(OPTION_VALUE_TYPES),
    required: looseValue,
    minSelected: looseValue,
    maxSelected: looseValue,
    requiredMessage: looseValue,
    selectionMessage: looseValue,
    successMessage: looseValue,
    iconLibrary: z.string().optional(),
    icon: looseValue,
    caretLibrary: z.string().optional(),
    caretIcon: looseValue,
    clearLibrary: z.string().optional(),
    clearIcon: looseValue,
    disabled: looseValue
  }),
  controls: [
    {
      key: "name",
      label: "Field name",
      kind: "text",
      placeholder: "choice",
      group: GROUP.field
    },
    text("label", "Label", GROUP.content),
    text("placeholder", "Empty text", GROUP.content),
    text("helpText", "Help text", GROUP.content),
    {
      key: "optionsSource",
      label: "Options",
      kind: "select",
      options: [
        { value: "static", label: "Fixed (written by hand)" },
        { value: "dynamic", label: "Dynamic (from a query)" }
      ],
      group: GROUP.options
    },
    {
      key: "valueType",
      label: "Value data type",
      kind: "select",
      options: OPTION_VALUE_TYPES.map((value) => ({ value, label: STATE_TYPE_LABELS[value] })),
      group: GROUP.options
    },
    toggle("multiple", "Choose several", GROUP.options),
    toggle("searchable", "Searchable", GROUP.options),
    text("searchPlaceholder", "Search hint", GROUP.options),
    text("noResultsText", "No results text", GROUP.options),
    {
      key: "display",
      label: "Show several as",
      kind: "select",
      options: [
        { value: "chips", label: "Chips" },
        { value: "text", label: "Text (a, b, c)" },
        { value: "count", label: "A count" }
      ],
      group: GROUP.options
    },
    text("maxChips", "Chips shown", GROUP.options, "3"),
    text("countText", "Count text", GROUP.options, DEFAULT_COUNT_TEXT),
    toggle("keepOpen", "Stay open while choosing (several)", GROUP.behavior),
    toggle("required", "Required", GROUP.validation),
    text("minSelected", "Fewest chosen", GROUP.validation),
    text("maxSelected", "Most chosen", GROUP.validation),
    ...messageControlsFor([
      { key: "requiredMessage", label: "Required message", message: "required" },
      { key: "selectionMessage", label: "Count message", message: "selection" }
    ]),
    text("successMessage", "Success message", GROUP.messages),
    {
      key: "icon",
      label: "Field icon",
      kind: "icon",
      libraryKey: "iconLibrary",
      group: GROUP.icons
    },
    {
      key: "caretIcon",
      label: "Arrow icon",
      kind: "icon",
      libraryKey: "caretLibrary",
      group: GROUP.icons
    },
    {
      key: "clearIcon",
      label: "Clear icon",
      kind: "icon",
      libraryKey: "clearLibrary",
      group: GROUP.icons
    },
    toggle("clearable", "Clear button", GROUP.behavior),
    toggle("disabled", "Disabled", GROUP.behavior)
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    label: true,
    placeholder: true,
    helpText: true,
    multiple: {
      reason:
        "Whether one or several options can be chosen decides how the value is kept, so it is fixed when the page is saved."
    },
    searchable: { reason: "Decides whether the panel draws a search box, so it is fixed." },
    searchPlaceholder: true,
    noResultsText: true,
    clearable: true,
    display: { reason: FIXED_REASON },
    maxChips: { reason: FIXED_REASON },
    countText: true,
    keepOpen: true,
    optionsSource: {
      reason:
        "Whether the options are written by hand or come from a query decides how the field is built, so it is fixed when the page is saved."
    },
    valueType: {
      reason:
        "The value data type decides how every option value is checked and how the field's value is typed, so it is fixed when the page is saved."
    },
    required: true,
    minSelected: true,
    maxSelected: true,
    requiredMessage: true,
    selectionMessage: true,
    successMessage: true,
    iconLibrary: { reason: ICON_REASON },
    icon: true,
    caretLibrary: { reason: ICON_REASON },
    caretIcon: true,
    clearLibrary: { reason: ICON_REASON },
    clearIcon: true,
    disabled: true
  },
  render: (ctx: RenderContext) => {
    const { attrs, node } = ctx;
    const name = ctx.text("name");
    const multiple = isMultiple(node);
    const many = valueKindOf(node) === "many";
    const searchable = on(ctx, "searchable");
    const required = on(ctx, "required");
    const disabled = on(ctx, "disabled");
    const display = selectDisplayOf(ctx.text("display"));
    const maxChips = maxChipsOf(ctx.text("maxChips"));
    const editing = ctx.mode === "editor" && attrs["data-nxt-open"] !== undefined;
    const base = `${attrs.id ?? attrs["data-nid"] ?? name}`;
    const labelId = `${base}-label`;
    const triggerId = `${base}-trigger`;
    const popoverId = `${base}-popover`;
    const listId = `${base}-list`;
    const notes = fieldNotes(ctx, { help: `${base}-help`, error: `${base}-error` });
    const title = ctx.text("label");
    const placeholder = ctx.text("placeholder");
    const chosen = startChoices(node);
    const messages: Record<string, string> = {};
    if (ctx.text("requiredMessage")) messages.required = ctx.text("requiredMessage");
    if (ctx.text("selectionMessage")) messages.selection = ctx.text("selectionMessage");

    const drawn = (libraryKey: string, nameKey: string) => {
      const iconName = ctx.text(nameKey);
      return iconName ? ctx.icon(ctx.text(libraryKey), iconName, { size: "1em", label: "" }) : null;
    };
    const fieldIcon = drawn("iconLibrary", "icon");
    const caret = drawn("caretLibrary", "caretIcon");
    const clear = drawn("clearLibrary", "clearIcon");

    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-field": name,
        "data-nxt-kind": many ? "many" : "one",
        "data-nxt-variant": "select",
        "data-nxt-multiple": multiple ? "" : undefined,
        "data-nxt-searchable": searchable ? "" : undefined,
        "data-nxt-display": display,
        "data-nxt-max-chips": maxChips,
        "data-nxt-count-text": ctx.text("countText") || undefined,
        "data-nxt-keep-open": multiple && on(ctx, "keepOpen") ? "" : undefined,
        "data-nxt-value-type": optionValueTypeOf(node),
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
        { "data-nxt-picker": "" },
        createElement(
          "div",
          { "data-nxt-box": "" },
          fieldIcon === null
            ? null
            : iconWrapper({ "data-nxt-icon": "" }, "", iconInner(fieldIcon)),
          createElement(
            "div",
            {
              id: triggerId,
              role: searchable ? "button" : "combobox",
              tabIndex: disabled ? -1 : 0,
              "aria-haspopup": "listbox",
              "aria-expanded": editing ? "true" : "false",
              "aria-controls": popoverId,
              "aria-labelledby": title ? labelId : undefined,
              "aria-label": title ? undefined : name,
              "aria-describedby": notes.describedBy,
              "aria-disabled": disabled || undefined,
              "aria-required": required || undefined,
              "data-nxt-trigger": "",
              "data-empty": chosen.length === 0 ? "" : undefined,
              "data-placeholder": placeholder || undefined
            },
            ...closedContent(
              chosen,
              multiple,
              display,
              maxChips,
              ctx.text("countText"),
              placeholder
            )
          ),
          on(ctx, "clearable")
            ? createElement(
                "button",
                {
                  type: "button",
                  hidden: chosen.length === 0 || undefined,
                  disabled: disabled || undefined,
                  tabIndex: -1,
                  "data-nxt-clear": "",
                  "aria-label": "Clear choice"
                },
                clear === null ? "×" : iconWrapper({}, "", iconInner(clear))
              )
            : null,
          caret === null
            ? createElement("span", { "data-nxt-caret": "", "aria-hidden": "true" }, glyph(CHEVRON))
            : iconWrapper({ "data-nxt-caret": "" }, "", iconInner(caret))
        ),
        createElement(
          "div",
          { id: popoverId, hidden: !editing || undefined, "data-nxt-popover": "" },
          searchable
            ? createElement(
                "div",
                { "data-nxt-search-row": "" },
                createElement("input", {
                  type: "text",
                  role: "combobox",
                  autoComplete: "off",
                  autoCorrect: "off",
                  spellCheck: false,
                  placeholder: ctx.text("searchPlaceholder") || undefined,
                  "aria-label": `Search ${title || name}`,
                  "aria-controls": listId,
                  "aria-expanded": "true",
                  "aria-autocomplete": "list",
                  "data-nxt-search": ""
                })
              )
            : null,
          createElement(
            "div",
            {
              id: listId,
              role: "listbox",
              "aria-multiselectable": multiple || undefined,
              "aria-labelledby": title ? labelId : undefined,
              "aria-label": title ? undefined : name,
              "data-nxt-listbox": ""
            },
            ctx.children
          ),
          createElement(
            "p",
            {
              role: "status",
              hidden: attrs["data-nxt-show"] === "empty" ? undefined : true,
              "data-nxt-empty": ""
            },
            ctx.text("noResultsText")
          )
        )
      ),
      ...notes.nodes
    );
  }
});
