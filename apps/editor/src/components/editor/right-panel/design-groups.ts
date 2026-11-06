export interface DesignProperty {
  property: string;
  label: string;
  options?: string[];
  placeholder?: string;
  /** Option value to DesignIcon key; when set the options are shown as icon buttons. */
  icons?: Record<string, string>;
}

export interface DesignGroup {
  id: string;
  label: string;
  /** DesignIcon key. */
  icon: string;
  properties: DesignProperty[];
}

// Phase 1 ships a basic set so breakpoints, states and change dots work end to end. The full
// Design tab (every CSS property, variables, classes) arrives in Phase 2.
export const DESIGN_GROUPS: DesignGroup[] = [
  {
    id: "layout",
    label: "Layout",
    icon: "group-layout",
    properties: [
      {
        property: "display",
        label: "Display",
        options: ["block", "flex", "grid", "inline", "inline-block", "none"]
      },
      { property: "gap", label: "Gap", placeholder: "16px" },
      { property: "column-gap", label: "Column gap", placeholder: "normal" },
      { property: "row-gap", label: "Row gap", placeholder: "normal" },
      { property: "flex-wrap", label: "Flex wrap", options: ["nowrap", "wrap", "wrap-reverse"] },
      {
        property: "flex-direction",
        label: "Direction",
        options: ["row", "column", "row-reverse", "column-reverse"],
        icons: {
          row: "row",
          column: "column",
          "row-reverse": "row-reverse",
          "column-reverse": "column-reverse"
        }
      },
      {
        property: "align-self",
        label: "Align self",
        options: ["flex-start", "center", "flex-end", "stretch", "baseline"],
        icons: {
          "flex-start": "top",
          center: "middle",
          "flex-end": "bottom",
          stretch: "stretch",
          baseline: "baseline"
        }
      },
      {
        property: "justify-content",
        label: "Align main axis",
        options: ["flex-start", "center", "flex-end", "space-between", "space-around"],
        icons: {
          "flex-start": "start",
          center: "center",
          "flex-end": "end",
          "space-between": "between",
          "space-around": "around"
        }
      },
      {
        property: "align-items",
        label: "Align cross axis",
        options: ["stretch", "flex-start", "center", "flex-end", "baseline"],
        icons: {
          stretch: "stretch",
          "flex-start": "top",
          center: "middle",
          "flex-end": "bottom",
          baseline: "baseline"
        }
      },
      { property: "flex-grow", label: "Flex grow", placeholder: "0" },
      { property: "flex-shrink", label: "Flex shrink", placeholder: "1" },
      { property: "flex-basis", label: "Flex basis", placeholder: "auto" },
      { property: "order", label: "Order", placeholder: "0" }
    ]
  },
  {
    id: "spacing",
    label: "Spacing",
    icon: "group-spacing",
    properties: [
      { property: "margin", label: "Margin", placeholder: "0 auto" },
      { property: "padding", label: "Padding", placeholder: "24px" }
    ]
  },
  {
    id: "size",
    label: "Size",
    icon: "group-size",
    properties: [
      { property: "width", label: "Width", placeholder: "100%" },
      { property: "max-width", label: "Max width", placeholder: "1200px" },
      { property: "height", label: "Height", placeholder: "auto" },
      { property: "min-height", label: "Min height", placeholder: "0" }
    ]
  },
  {
    id: "typography",
    label: "Typography",
    icon: "group-typography",
    properties: [
      { property: "font-size", label: "Font size", placeholder: "16px" },
      { property: "font-weight", label: "Font weight", options: ["400", "500", "600", "700"] },
      { property: "line-height", label: "Line height", placeholder: "1.5" },
      {
        property: "text-align",
        label: "Text align",
        options: ["left", "center", "right", "justify"],
        icons: {
          left: "text-left",
          center: "text-center",
          right: "text-right",
          justify: "text-justify"
        }
      },
      { property: "color", label: "Color", placeholder: "#111111" }
    ]
  },
  {
    id: "background",
    label: "Background",
    icon: "group-background",
    properties: [{ property: "background-color", label: "Color", placeholder: "#ffffff" }]
  },
  {
    id: "border",
    label: "Border",
    icon: "group-border",
    properties: [
      { property: "border", label: "Border", placeholder: "1px solid #ccc" },
      { property: "border-radius", label: "Radius", placeholder: "8px" }
    ]
  }
];
