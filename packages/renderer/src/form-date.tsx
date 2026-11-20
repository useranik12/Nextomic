import {
  DATE_MODES,
  DATE_STYLES,
  DEFAULT_MESSAGES,
  dateModeOf,
  dateOfParts,
  dayInLimits,
  dayName,
  datePartOf,
  hoursOf,
  minutesOf,
  monthGrid,
  monthTitle,
  normalizeDate,
  parseValue,
  showValue,
  twelveHour,
  weekdayNames,
  MINUTE_STEPS,
  type DateMode,
  type DateStyle,
  type YMD
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
  on
} from "./field-parts";
import { registerElement } from "./registry";

// Date and time (elements.md "Date and time"): a field that opens a calendar and clock popover. The
// value is ISO text in local wall time (`YYYY-MM-DD`, `HH:mm`, `YYYY-MM-DDTHH:mm`) held in one
// hidden control. This file draws every part, always 42 day cells, so the page never shows markup the
// runtime has to build; `packages/runtime/src/form/date-field.ts` opens the popover, moves the month,
// and rewrites the text of the cells. Rendering never asks what today is: that is the client's.

const FALLBACK: YMD = { y: 2026, m: 1, d: 1 };
const WEEK_STARTS = ["0", "1", "2", "3", "4", "5", "6"] as const;
const CLOCKS = ["12", "24"] as const;

const ICON_LIBRARY_REASON =
  "Only the icon name is dynamic; the library decides which icon sets a page loads.";
const FIXED_REASON = "A fixed layout choice, not data.";

const PATHS: Record<string, string[]> = {
  calendar: [
    "M7 3v3M17 3v3M4 9h16",
    "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
  ],
  clock: ["M12 7v5l3 2", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"],
  prev: ["M15 6l-6 6 6 6"],
  next: ["M9 6l6 6-6 6"]
};

/** A small built-in line icon, used until the author picks a library icon. */
const glyph = (name: keyof typeof PATHS): ReactNode =>
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
    ...(PATHS[name] ?? []).map((d) => createElement("path", { key: d, d }))
  );

const pick = <T extends string>(list: readonly T[], value: string, fallback: T): T =>
  list.find((item) => item === value) ?? fallback;

registerElement({
  type: "dateTime",
  label: "Date and Time",
  category: "forms",
  canHaveChildren: false,
  defaults: () => ({
    props: {
      name: "date",
      label: "Date",
      mode: "date",
      value: "",
      min: "",
      max: "",
      placeholder: "Select a date",
      displayStyle: "medium",
      locale: "",
      weekStart: "0",
      clock: "12",
      minuteStep: "5",
      iconLibrary: "",
      icon: "",
      clearable: true,
      showToday: true,
      todayLabel: "Today",
      doneLabel: "Done",
      required: false,
      requiredMessage: DEFAULT_MESSAGES.required,
      typeMessage: DEFAULT_MESSAGES.type,
      rangeMessage: DEFAULT_MESSAGES.range,
      successMessage: "",
      helpText: "",
      disabled: false
    },
    name: "Date"
  }),
  propsSchema: z.object({
    name: z.string(),
    label: looseValue,
    mode: z.enum(DATE_MODES),
    value: looseValue,
    min: looseValue,
    max: looseValue,
    placeholder: looseValue,
    displayStyle: z.enum(DATE_STYLES),
    locale: looseValue,
    weekStart: z.enum(WEEK_STARTS),
    clock: z.enum(CLOCKS),
    minuteStep: z.string(),
    iconLibrary: z.string().optional(),
    icon: looseValue,
    clearable: looseValue,
    showToday: looseValue,
    todayLabel: looseValue,
    doneLabel: looseValue,
    required: looseValue,
    requiredMessage: looseValue,
    typeMessage: looseValue,
    rangeMessage: looseValue,
    successMessage: looseValue,
    helpText: looseValue,
    disabled: looseValue
  }),
  controls: [
    { key: "name", label: "Field name", kind: "text", placeholder: "birthday", group: GROUP.field },
    { key: "label", label: "Label", kind: "text", group: GROUP.content },
    {
      key: "mode",
      label: "Picks",
      kind: "select",
      options: [
        { value: "date", label: "A date" },
        { value: "time", label: "A time" },
        { value: "datetime", label: "A date and a time" }
      ],
      group: GROUP.content
    },
    {
      key: "value",
      label: "Default value",
      kind: "text",
      placeholder: "2026-11-18",
      group: GROUP.content
    },
    { key: "placeholder", label: "Empty text", kind: "text", group: GROUP.content },
    { key: "helpText", label: "Help text", kind: "text", group: GROUP.content },
    {
      key: "min",
      label: "Earliest",
      kind: "text",
      placeholder: "2026-01-01",
      group: GROUP.validation
    },
    {
      key: "max",
      label: "Latest",
      kind: "text",
      placeholder: "2026-12-31",
      group: GROUP.validation
    },
    { key: "required", label: "Required", kind: "switch", group: GROUP.validation },
    ...messageControlsFor([
      { key: "requiredMessage", label: "Required message", message: "required" },
      { key: "typeMessage", label: "Format message", message: "type" },
      { key: "rangeMessage", label: "Range message", message: "range" }
    ]),
    { key: "successMessage", label: "Success message", kind: "text", group: GROUP.messages },
    {
      key: "displayStyle",
      label: "Shown as",
      kind: "select",
      options: [
        { value: "short", label: "Short (11/18/26)" },
        { value: "medium", label: "Medium (Nov 18, 2026)" },
        { value: "long", label: "Long (Wednesday, November 18, 2026)" }
      ],
      group: GROUP.options
    },
    {
      key: "locale",
      label: "Language",
      kind: "text",
      placeholder: "Page language (for example de-DE)",
      group: GROUP.options
    },
    {
      key: "weekStart",
      label: "Week starts on",
      kind: "select",
      options: [
        { value: "0", label: "Sunday" },
        { value: "1", label: "Monday" },
        { value: "2", label: "Tuesday" },
        { value: "3", label: "Wednesday" },
        { value: "4", label: "Thursday" },
        { value: "5", label: "Friday" },
        { value: "6", label: "Saturday" }
      ],
      group: GROUP.options
    },
    {
      key: "clock",
      label: "Clock",
      kind: "select",
      options: [
        { value: "12", label: "12-hour (AM/PM)" },
        { value: "24", label: "24-hour" }
      ],
      group: GROUP.options
    },
    {
      key: "minuteStep",
      label: "Minute step",
      kind: "select",
      options: MINUTE_STEPS.map((step) => ({ value: String(step), label: `${step} min` })),
      group: GROUP.options
    },
    {
      key: "icon",
      label: "Field icon",
      kind: "icon",
      libraryKey: "iconLibrary",
      group: GROUP.icons
    },
    { key: "clearable", label: "Clear button", kind: "switch", group: GROUP.behavior },
    { key: "showToday", label: "Today / Now button", kind: "switch", group: GROUP.behavior },
    { key: "todayLabel", label: "Today button text", kind: "text", group: GROUP.behavior },
    { key: "doneLabel", label: "Done button text", kind: "text", group: GROUP.behavior },
    { key: "disabled", label: "Disabled", kind: "switch", group: GROUP.behavior }
  ],
  bindable: {
    name: { reason: FORM_NAME_REASON },
    label: true,
    mode: { reason: "Decides which parts the field draws, so it cannot change on the page." },
    value: true,
    min: true,
    max: true,
    placeholder: true,
    displayStyle: { reason: FIXED_REASON },
    locale: true,
    weekStart: { reason: FIXED_REASON },
    clock: { reason: FIXED_REASON },
    minuteStep: { reason: FIXED_REASON },
    iconLibrary: { reason: ICON_LIBRARY_REASON },
    icon: true,
    clearable: true,
    showToday: true,
    todayLabel: true,
    doneLabel: true,
    required: true,
    requiredMessage: true,
    typeMessage: true,
    rangeMessage: true,
    successMessage: true,
    helpText: true,
    disabled: true
  },
  render: (ctx) => {
    const { attrs } = ctx;
    const name = ctx.text("name");
    const mode: DateMode = dateModeOf(ctx.text("mode"));
    const style: DateStyle = pick(DATE_STYLES, ctx.text("displayStyle"), "medium");
    const weekStart = Number(pick(WEEK_STARTS, ctx.text("weekStart"), "0"));
    const clock = pick(CLOCKS, ctx.text("clock"), "12");
    const step = Number(MINUTE_STEPS.find((s) => String(s) === ctx.text("minuteStep")) ?? 5);
    const locale = ctx.text("locale");
    const value = normalizeDate(mode, ctx.text("value"));
    const min = normalizeDate(mode, ctx.text("min"));
    const max = normalizeDate(mode, ctx.text("max"));
    const minDay = datePartOf(mode, min);
    const maxDay = datePartOf(mode, max);
    const parsed = parseValue(mode, value);
    const required = on(ctx, "required");
    const disabled = on(ctx, "disabled");
    const editing = ctx.mode === "editor" && attrs["data-nxt-open"] !== undefined;
    const fieldId = `${attrs.id ?? attrs["data-nid"] ?? name}`;
    const controlId = `${fieldId}-control`;
    const popoverId = `${fieldId}-popover`;
    const notes = fieldNotes(ctx, { help: `${controlId}-help`, error: `${controlId}-error` });
    const placeholder = ctx.text("placeholder");
    const display = value
      ? showValue(mode, value, {
          locale: locale || "en-US",
          style,
          hour12: clock === "12"
        })
      : "";
    const range = ctx.text("rangeMessage");
    const typeMessage = ctx.text("typeMessage");
    const requiredMessage = ctx.text("requiredMessage");
    const view: YMD = parsed?.date ?? parseValue("date", minDay)?.date ?? FALLBACK;
    const picked = parsed?.date ? dateOfParts(parsed.date) : "";
    const grid = monthGrid(view.y, view.m, weekStart);
    // In the editor the popover is open to be designed; with no value, one day stands in as today.
    const stand = editing && picked === "" ? dateOfParts({ ...view, d: 15 }) : "";
    const focusDay = picked || grid.find((cell) => cell.inMonth)?.iso || "";
    const names = weekdayNames(locale || "en-US", weekStart);
    const iconName = ctx.text("icon");
    const drawn = iconName
      ? ctx.icon(ctx.text("iconLibrary"), iconName, { size: "1em", label: "" })
      : null;
    const fieldIcon =
      drawn === null
        ? createElement(
            "span",
            { "data-nxt-icon": "" },
            glyph(mode === "time" ? "clock" : "calendar")
          )
        : iconWrapper({ "data-nxt-icon": "" }, "", iconInner(drawn));

    const day = (cell: (typeof grid)[number]) => {
      const blocked = !dayInLimits(cell.iso, minDay, maxDay);
      return createElement(
        "button",
        {
          key: cell.iso,
          type: "button",
          role: "gridcell",
          tabIndex: cell.iso === focusDay ? 0 : -1,
          "aria-label": dayName(cell, locale || "en-US"),
          "aria-selected": cell.iso === picked ? "true" : "false",
          "aria-disabled": blocked ? "true" : undefined,
          "data-nxt-day": "",
          "data-date": cell.iso,
          "data-outside": cell.inMonth ? undefined : "",
          "data-today": cell.iso === stand ? "" : undefined
        },
        String(cell.d)
      );
    };
    const calendar =
      mode === "time"
        ? null
        : createElement(
            "div",
            { "data-nxt-calendar": "" },
            createElement(
              "div",
              { "data-nxt-calhead": "" },
              createElement(
                "button",
                { type: "button", "data-nxt-nav": "-1", "aria-label": "Previous month" },
                glyph("prev")
              ),
              createElement(
                "div",
                { "data-nxt-title": "", "aria-live": "polite" },
                monthTitle(view.y, view.m, locale || "en-US")
              ),
              createElement(
                "button",
                { type: "button", "data-nxt-nav": "1", "aria-label": "Next month" },
                glyph("next")
              )
            ),
            createElement(
              "div",
              { role: "grid", "aria-label": monthTitle(view.y, view.m, locale || "en-US") },
              createElement(
                "div",
                { role: "row", "data-nxt-weekdays": "" },
                ...names.map((n, i) =>
                  createElement(
                    "span",
                    { key: i, role: "columnheader", "aria-label": n.long, "data-nxt-weekday": "" },
                    n.short
                  )
                )
              ),
              createElement(
                "div",
                { "data-nxt-days": "" },
                ...Array.from({ length: 6 }, (_, row) =>
                  createElement(
                    "div",
                    { key: row, role: "row", "data-nxt-week": "" },
                    ...grid.slice(row * 7, row * 7 + 7).map(day)
                  )
                )
              )
            )
          );

    const hourNow = parsed?.time?.h ?? -1;
    const minuteNow = parsed?.time?.min ?? -1;
    const option = (kind: string, v: number, label: string, selected: boolean) =>
      createElement(
        "button",
        {
          key: `${kind}${v}`,
          type: "button",
          role: "option",
          tabIndex: -1,
          "aria-selected": selected ? "true" : "false",
          "data-nxt-time": kind,
          "data-v": v
        },
        label
      );
    const column = (kind: string, label: string, items: ReactNode[]) =>
      createElement(
        "div",
        { key: kind, role: "listbox", "aria-label": label, "data-nxt-timecol": kind },
        ...items
      );
    const columns: ReactNode[] = [];
    if (clock === "12") {
      const now = hourNow >= 0 ? twelveHour(hourNow) : null;
      columns.push(
        column(
          "hour",
          "Hour",
          Array.from({ length: 12 }, (_, i) => i + 1).map((h) =>
            option("hour", h, String(h), now?.hour === h)
          )
        )
      );
    } else {
      columns.push(
        column(
          "hour",
          "Hour",
          hoursOf().map((h) => option("hour", h, String(h).padStart(2, "0"), hourNow === h))
        )
      );
    }
    columns.push(
      column(
        "minute",
        "Minute",
        minutesOf(step).map((m) => option("minute", m, String(m).padStart(2, "0"), minuteNow === m))
      )
    );
    if (clock === "12") {
      const pm = hourNow >= 12;
      columns.push(
        column("meridiem", "AM or PM", [
          option("meridiem", 0, "AM", hourNow >= 0 && !pm),
          option("meridiem", 1, "PM", hourNow >= 0 && pm)
        ])
      );
    }
    const times =
      mode === "date" ? null : createElement("div", { "data-nxt-times": "" }, ...columns);
    const todayLabel = ctx.text("todayLabel") || (mode === "time" ? "Now" : "Today");
    const foot = createElement(
      "div",
      { "data-nxt-foot": "" },
      on(ctx, "showToday")
        ? createElement("button", { type: "button", "data-nxt-today-btn": "" }, todayLabel)
        : null,
      createElement(
        "button",
        { type: "button", "data-nxt-done": "" },
        ctx.text("doneLabel") || "Done"
      )
    );
    const label = ctx.text("label");

    return createElement(
      "div",
      {
        ...attrs,
        "data-nxt-field": name,
        "data-nxt-kind": "date",
        "data-nxt-mode": mode,
        "data-nxt-min": min || undefined,
        "data-nxt-max": max || undefined,
        "data-nxt-week-start": weekStart,
        "data-nxt-clock": clock,
        "data-nxt-minute-step": step,
        "data-nxt-style": style,
        "data-nxt-locale": locale || undefined,
        "data-nxt-rules": JSON.stringify({
          type: "text",
          required,
          dateMode: mode,
          minDate: min,
          maxDate: max,
          messages: {
            ...(requiredMessage ? { required: requiredMessage } : {}),
            ...(typeMessage ? { type: typeMessage } : {}),
            ...(range ? { range } : {})
          }
        })
      },
      label
        ? createElement("label", { htmlFor: controlId, "data-required": flag(required) }, label)
        : null,
      createElement(
        "div",
        { "data-nxt-picker": "" },
        createElement(
          "div",
          { "data-nxt-box": "" },
          fieldIcon,
          createElement(
            "button",
            {
              id: controlId,
              type: "button",
              disabled: disabled || undefined,
              "aria-haspopup": "dialog",
              "aria-expanded": editing ? "true" : "false",
              "aria-controls": popoverId,
              "aria-describedby": notes.describedBy,
              "data-nxt-trigger": "",
              "data-empty": display === "" ? "" : undefined,
              "data-placeholder": placeholder || undefined
            },
            display || placeholder
          ),
          on(ctx, "clearable")
            ? createElement(
                "button",
                {
                  type: "button",
                  hidden: value === "" || undefined,
                  disabled: disabled || undefined,
                  "data-nxt-clear": "",
                  "aria-label": "Clear value"
                },
                "×"
              )
            : null
        ),
        createElement("input", {
          key: value,
          type: "hidden",
          defaultValue: value,
          disabled: disabled || undefined,
          "data-nxt-control": ""
        }),
        createElement(
          "div",
          {
            id: popoverId,
            role: "dialog",
            "aria-label": label || name,
            hidden: !editing || undefined,
            "data-nxt-popover": ""
          },
          calendar,
          times,
          foot
        )
      ),
      ...notes.nodes
    );
  }
});
