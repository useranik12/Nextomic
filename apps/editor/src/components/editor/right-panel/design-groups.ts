export interface DesignProperty {
  property: string;
  label: string;
  options?: string[];
  placeholder?: string;
}

export interface DesignGroup {
  id: string;
  label: string;
  properties: DesignProperty[];
}

// Phase 1 ships a basic set so breakpoints, states and change dots work end to end. The full
// Design tab (every CSS property, variables, classes) arrives in Phase 2.
export const DESIGN_GROUPS: DesignGroup[] = [
  {
    id: "layout",
    label: "Layout",
    properties: [
      {
        property: "display",
        label: "Display",
        options: ["block", "flex", "grid", "inline", "inline-block", "none"]
      },
      {
        property: "flex-direction",
        label: "Direction",
        options: ["row", "column", "row-reverse", "column-reverse"]
      },
      {
        property: "justify-content",
        label: "Justify",
        options: ["flex-start", "center", "flex-end", "space-between", "space-around"]
      },
      {
        property: "align-items",
        label: "Align",
        options: ["stretch", "flex-start", "center", "flex-end", "baseline"]
      },
      { property: "gap", label: "Gap", placeholder: "16px" }
    ]
  },
  {
    id: "spacing",
    label: "Spacing",
    properties: [
      { property: "margin", label: "Margin", placeholder: "0 auto" },
      { property: "padding", label: "Padding", placeholder: "24px" }
    ]
  },
  {
    id: "size",
    label: "Size",
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
    properties: [
      { property: "font-size", label: "Font size", placeholder: "16px" },
      { property: "font-weight", label: "Font weight", options: ["400", "500", "600", "700"] },
      { property: "line-height", label: "Line height", placeholder: "1.5" },
      {
        property: "text-align",
        label: "Text align",
        options: ["left", "center", "right", "justify"]
      },
      { property: "color", label: "Color", placeholder: "#111111" }
    ]
  },
  {
    id: "background",
    label: "Background",
    properties: [{ property: "background-color", label: "Color", placeholder: "#ffffff" }]
  },
  {
    id: "border",
    label: "Border",
    properties: [
      { property: "border", label: "Border", placeholder: "1px solid #ccc" },
      { property: "border-radius", label: "Radius", placeholder: "8px" }
    ]
  }
];
