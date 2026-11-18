// Design of the Date and time field (docs/elements.md "Date and time design"). Same method as the
// other form fields: every part is a sub-group stored as `--nxt-ip-<part>-<property>[-<state>]`.
// The calendar is drawn from plain elements, so every part is designable. Today and the days of
// other months are their own parts (not states): a day can be today and hovered at once.

import { DESIGN_KIT, INPUT_PARTS, type InputPart } from "./input-design";
import { repeatedStates } from "./part-states";

const { p, TEXT, BORDER, EFFECTS, SIZE, SPACING, ORDER } = DESIGN_KIT;

const DAY = "[data-nxt-day]";
const OPTION = "[data-nxt-time]";

const buttonStates = (selector: string) =>
  repeatedStates(selector, {
    hover: ":where(:hover)",
    focus: ":where(:focus-visible)",
    disabled: ":where(:disabled)"
  });

const dayStates = (selector: string) =>
  repeatedStates(selector, {
    hover: ":where(:hover)",
    focus: ":where(:focus-visible)",
    checked: ':where([aria-selected="true"])',
    disabled: ':where([aria-disabled="true"])'
  });

const optionStates = (selector: string) =>
  repeatedStates(selector, {
    hover: ":where(:hover)",
    focus: ":where(:focus-visible)",
    checked: ':where([aria-selected="true"])',
    disabled: ":where(:disabled)"
  });

const FLEX = (gap: string) => ({
  label: "Layout",
  props: [
    p("display", "Display", { options: ["flex", "grid", "block", "none"] }),
    p("flex-direction", "Direction", { options: ["row", "row-reverse", "column"] }),
    p("align-items", "Align items", { options: ["center", "flex-start", "flex-end", "stretch"] }),
    p("justify-content", "Justify", {
      options: ["flex-start", "center", "flex-end", "space-between", "space-around"]
    }),
    p("gap", "Gap", { placeholder: gap })
  ]
});

const popoverPart: InputPart = {
  id: "popover",
  label: "Popover",
  about: "The panel that opens under the field. Its position and the open animation are set here.",
  selector: "[data-nxt-popover]",
  states: ["default"],
  groups: [
    {
      label: "Position",
      props: [
        p("top", "Top", { placeholder: "calc(100% + 6px)" }),
        p("left", "Left", { placeholder: "0" }),
        p("right", "Right"),
        p("z-index", "Stack order", { placeholder: "30" })
      ]
    },
    {
      label: "Layout",
      props: [
        p("flex-direction", "Direction", { options: ["row", "row-reverse", "column"] }),
        p("align-items", "Align items", {
          options: ["flex-start", "center", "flex-end", "stretch"]
        }),
        p("gap", "Gap", { placeholder: "12px" })
      ]
    },
    SIZE(),
    SPACING,
    BORDER,
    {
      label: "Effects",
      props: [
        p("box-shadow", "Shadow", { placeholder: "0 12px 32px rgba(0,0,0,.18)" }),
        p("opacity", "Opacity"),
        p("transform", "Transform", { placeholder: "translateY(0)" }),
        p("transition", "Transition")
      ]
    }
  ]
};

const calendarPart: InputPart = {
  id: "calendar",
  label: "Calendar",
  about: "The month view: the bar with the title and buttons, the weekdays and the days.",
  selector: "[data-nxt-calendar]",
  states: ["default"],
  groups: [
    {
      label: "Layout",
      props: [
        p("display", "Display", { options: ["flex", "grid", "block", "none"] }),
        p("flex-direction", "Direction", { options: ["column", "row"] }),
        p("gap", "Gap", { placeholder: "8px" })
      ]
    },
    SIZE(),
    SPACING,
    {
      label: "Background",
      props: [p("background-color", "Background"), p("border-radius", "Radius")]
    }
  ]
};

const calHeadPart: InputPart = {
  id: "calhead",
  label: "Month bar",
  about: "The row with the previous button, the month title and the next button.",
  selector: "[data-nxt-calhead]",
  states: ["default"],
  groups: [
    FLEX("8px"),
    SPACING,
    { label: "Background", props: [p("background-color", "Background")] }
  ]
};

const titlePart: InputPart = {
  id: "title",
  label: "Month title",
  about: "The month and year.",
  selector: "[data-nxt-title]",
  states: ["default"],
  groups: [TEXT, SPACING, { label: "Layout", props: [p("flex-grow", "Grow"), ORDER] }]
};

const navPart: InputPart = {
  id: "nav",
  label: "Month buttons",
  about: "The previous and next month buttons.",
  selector: "[data-nxt-nav]",
  states: ["default", "hover", "focus", "disabled"],
  stateTails: buttonStates("[data-nxt-nav]"),
  groups: [
    {
      label: "Icon",
      props: [p("font-size", "Icon size", { placeholder: "18px" }), p("color", "Icon color")]
    },
    SIZE(),
    BORDER,
    SPACING,
    EFFECTS
  ]
};

const weekdaysPart: InputPart = {
  id: "weekdays",
  label: "Weekday row",
  about: "The row of weekday names above the days.",
  selector: "[data-nxt-weekdays]",
  states: ["default"],
  groups: [
    {
      label: "Layout",
      props: [
        p("gap", "Gap", { placeholder: "0" }),
        p("grid-template-columns", "Grid columns", { placeholder: "repeat(7, 1fr)" })
      ]
    },
    SPACING,
    {
      label: "Background",
      props: [p("background-color", "Background"), p("border-radius", "Radius")]
    }
  ]
};

const weekdayPart: InputPart = {
  id: "weekday",
  label: "Weekday name",
  about: "One weekday name (Mon, Tue ...).",
  selector: "[data-nxt-weekday]",
  states: ["default"],
  groups: [TEXT, SIZE(), SPACING]
};

const daysPart: InputPart = {
  id: "days",
  label: "Days grid",
  about: "The grid that holds the days of the month.",
  selector: "[data-nxt-days]",
  states: ["default"],
  groups: [
    {
      label: "Layout",
      props: [
        p("gap", "Gap", { placeholder: "2px" }),
        p("row-gap", "Row gap"),
        p("column-gap", "Column gap"),
        p("grid-template-columns", "Grid columns", { placeholder: "repeat(7, 1fr)" })
      ]
    },
    SPACING,
    {
      label: "Background",
      props: [p("background-color", "Background"), p("border-radius", "Radius")]
    }
  ]
};

const DAY_GROUPS = [
  TEXT,
  SIZE(),
  BORDER,
  SPACING,
  {
    label: "Effects",
    props: [
      p("box-shadow", "Shadow"),
      p("opacity", "Opacity"),
      p("transition", "Transition"),
      p("transform", "Transform", { placeholder: "scale(1.05)" })
    ]
  }
];

const dayPart: InputPart = {
  id: "day",
  label: "Day",
  about:
    "Every day of the month. Selected is the chosen day; Disabled is a day outside the limits.",
  selector: DAY,
  states: ["default", "hover", "focus", "checked", "disabled"],
  stateTails: dayStates(DAY),
  groups: DAY_GROUPS
};

const TODAY = "[data-nxt-day][data-today]";
const todayPart: InputPart = {
  id: "today",
  label: "Today",
  about: "The day that is today. Its settings sit on top of the Day settings.",
  selector: TODAY,
  states: ["default", "hover", "checked"],
  stateTails: repeatedStates(TODAY, {
    hover: ":where(:hover)",
    checked: ':where([aria-selected="true"])'
  }),
  groups: DAY_GROUPS
};

const OUTSIDE = "[data-nxt-day][data-outside]";
const outsidePart: InputPart = {
  id: "outside",
  label: "Days of other months",
  about: "The grey days of the month before and after that fill the first and last week.",
  selector: OUTSIDE,
  states: ["default", "hover"],
  stateTails: repeatedStates(OUTSIDE, { hover: ":where(:hover)" }),
  groups: [
    TEXT,
    { label: "Effects", props: [p("opacity", "Opacity"), p("visibility", "Visibility")] }
  ]
};

const timesPart: InputPart = {
  id: "times",
  label: "Time pickers",
  about: "The box that holds the hour, minute and AM/PM lists.",
  selector: "[data-nxt-times]",
  states: ["default"],
  groups: [FLEX("8px"), SIZE(), SPACING, BORDER]
};

const timeColPart: InputPart = {
  id: "timecol",
  label: "Time list",
  about: "One list of the hour, minute or AM/PM choices. Give it a height to make it scroll.",
  selector: "[data-nxt-timecol]",
  states: ["default"],
  groups: [
    FLEX("2px"),
    {
      label: "Size",
      props: [
        p("width", "Width"),
        p("max-height", "Max height", { placeholder: "200px" }),
        p("overflow-y", "Scroll", { options: ["auto", "scroll", "hidden", "visible"] })
      ]
    },
    SPACING,
    BORDER
  ]
};

const timeOptPart: InputPart = {
  id: "timeopt",
  label: "Time choice",
  about: "One hour, minute or AM/PM choice.",
  selector: OPTION,
  states: ["default", "hover", "focus", "checked", "disabled"],
  stateTails: optionStates(OPTION),
  groups: DAY_GROUPS
};

const footPart: InputPart = {
  id: "foot",
  label: "Footer buttons",
  about: "The Today / Now, Clear and Done buttons under the calendar.",
  selector: "[data-nxt-foot] button",
  states: ["default", "hover", "focus"],
  stateTails: buttonStates("[data-nxt-foot] button"),
  groups: [TEXT, SIZE(), BORDER, SPACING, EFFECTS]
};

const footRowPart: InputPart = {
  id: "footrow",
  label: "Footer",
  about: "The row that holds the footer buttons.",
  selector: "[data-nxt-foot]",
  states: ["default"],
  groups: [FLEX("8px"), SPACING, BORDER]
};

const displayPart: InputPart = {
  id: "display",
  label: "Shown value",
  about: "The date or time the visitor chose, shown in the field.",
  selector: "[data-nxt-trigger]",
  states: ["default", "focus", "error", "success", "disabled"],
  groups: [
    TEXT,
    SPACING,
    { label: "Other", props: [p("background-color", "Background"), p("min-height", "Min height")] }
  ]
};

const emptyPart: InputPart = {
  id: "empty",
  label: "Empty text",
  about: "The words shown while no date is chosen (the placeholder).",
  selector: "[data-nxt-trigger][data-empty]",
  states: ["default"],
  groups: [TEXT]
};

const shared = (id: string): InputPart => {
  const part = INPUT_PARTS.find((item) => item.id === id);
  if (!part) throw new Error(`Form design part "${id}" is missing`);
  return part;
};

/** Parts only the Date and time field has. */
export const DATE_PARTS: readonly InputPart[] = [
  displayPart,
  emptyPart,
  popoverPart,
  calendarPart,
  calHeadPart,
  titlePart,
  navPart,
  weekdaysPart,
  weekdayPart,
  daysPart,
  dayPart,
  todayPart,
  outsidePart,
  timesPart,
  timeColPart,
  timeOptPart,
  footRowPart,
  footPart
];

/** The parts of a Date and time field, in panel order. */
export const DATE_PANEL_PARTS: readonly InputPart[] = [
  shared("field"),
  shared("label"),
  shared("required"),
  shared("box"),
  shared("icon"),
  displayPart,
  emptyPart,
  shared("clear"),
  popoverPart,
  calendarPart,
  calHeadPart,
  titlePart,
  navPart,
  weekdaysPart,
  weekdayPart,
  daysPart,
  dayPart,
  todayPart,
  outsidePart,
  timesPart,
  timeColPart,
  timeOptPart,
  footRowPart,
  footPart,
  shared("help"),
  shared("error"),
  shared("success")
];
