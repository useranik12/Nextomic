export interface DesignProperty {
  property: string;
  label: string;
  options?: string[];
  placeholder?: string;
  /** Option value to DesignIcon key; when set the options are shown as icon buttons. */
  icons?: Record<string, string>;
  /** A box of four values (margin, padding, border width, radius, offsets): the SIDE_SETS id. */
  sides?: string;
  /** Plain words about the setting, shown by the (i) beside the label. */
  tip?: string;
  /** Options come from the font in use: the weights and styles it really has. */
  fontOption?: "weight" | "style";
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
      {
        property: "margin",
        label: "Margin",
        sides: "margin",
        tip: "Space outside the element. Use the link buttons to set all sides together, top and bottom with left and right, or each side alone."
      },
      {
        property: "padding",
        label: "Padding",
        sides: "padding",
        tip: "Space between the element's edge and its content."
      }
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
      { property: "min-width", label: "Min width", placeholder: "0" },
      { property: "min-height", label: "Min height", placeholder: "0" },
      { property: "max-height", label: "Max height", placeholder: "none" },
      { property: "aspect-ratio", label: "Aspect ratio", placeholder: "16 / 9" },
      {
        property: "object-fit",
        label: "Object fit",
        options: ["fill", "contain", "cover", "none", "scale-down"]
      }
    ]
  },
  {
    id: "typography",
    label: "Typography",
    icon: "group-typography",
    properties: [
      {
        property: "font-family",
        label: "Font family",
        placeholder: "system-ui, sans-serif",
        tip: "Pick one of your project fonts or a system font. The weights and styles below follow the font you choose."
      },
      { property: "font-size", label: "Font size", placeholder: "16" },
      {
        property: "font-weight",
        label: "Font weight",
        fontOption: "weight",
        options: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
        tip: "Only the weights installed for this font are listed."
      },
      {
        property: "font-style",
        label: "Font style",
        fontOption: "style",
        options: ["normal", "italic", "oblique"],
        tip: "Italic appears only when the font has an italic face installed."
      },
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
      { property: "color", label: "Color", placeholder: "#111111" },
      { property: "letter-spacing", label: "Letter spacing", placeholder: "0" },
      {
        property: "text-transform",
        label: "Transform",
        options: ["none", "uppercase", "lowercase", "capitalize"]
      },
      {
        property: "text-decoration-line",
        label: "Decoration",
        options: ["none", "underline", "line-through", "overline"]
      },
      {
        property: "white-space",
        label: "White space",
        options: ["normal", "nowrap", "pre", "pre-wrap"]
      }
    ]
  },
  {
    id: "background",
    label: "Background",
    icon: "group-background",
    properties: [
      { property: "background-color", label: "Color", placeholder: "#ffffff" },
      {
        property: "background-image",
        label: "Image",
        placeholder: "url(...) or linear-gradient(...)"
      },
      {
        property: "background-size",
        label: "Size",
        options: ["auto", "cover", "contain"]
      },
      { property: "background-position", label: "Position", placeholder: "center" },
      {
        property: "background-repeat",
        label: "Repeat",
        options: ["repeat", "no-repeat", "repeat-x", "repeat-y"]
      }
    ]
  },
  {
    id: "border",
    label: "Border",
    icon: "group-border",
    properties: [
      {
        property: "border-width",
        label: "Border width",
        sides: "border-width",
        tip: "The thickness of each edge. A border shows only when the style is not none."
      },
      {
        property: "border-style",
        label: "Border style",
        options: ["none", "solid", "dashed", "dotted", "double"]
      },
      { property: "border-color", label: "Border color", placeholder: "#cccccc" },
      {
        property: "border-radius",
        label: "Radius",
        sides: "border-radius",
        tip: "Rounds each corner on its own, or all together."
      },
      { property: "outline", label: "Outline", placeholder: "2px solid #06f" }
    ]
  },
  {
    id: "position",
    label: "Position",
    icon: "group-position",
    properties: [
      {
        property: "position",
        label: "Position",
        options: ["static", "relative", "absolute", "fixed", "sticky"]
      },
      {
        property: "inset",
        label: "Offsets",
        sides: "inset",
        tip: "Distance from each edge for positioned elements (relative, absolute, fixed, sticky)."
      },
      { property: "z-index", label: "Z-index", placeholder: "auto" },
      {
        property: "overflow",
        label: "Overflow",
        options: ["visible", "hidden", "scroll", "auto", "clip"]
      }
    ]
  },
  {
    id: "effects",
    label: "Effects",
    icon: "group-effects",
    properties: [
      { property: "opacity", label: "Opacity", placeholder: "1" },
      { property: "box-shadow", label: "Box shadow", placeholder: "0 4px 12px rgba(0,0,0,.2)" },
      { property: "filter", label: "Filter", placeholder: "blur(4px)" },
      { property: "backdrop-filter", label: "Backdrop filter", placeholder: "blur(8px)" },
      { property: "transform", label: "Transform", placeholder: "translateY(-2px)" },
      { property: "transition", label: "Transition", placeholder: "all 300ms ease" },
      {
        property: "cursor",
        label: "Cursor",
        options: ["auto", "pointer", "default", "not-allowed", "grab", "text"]
      },
      {
        property: "pointer-events",
        label: "Pointer events",
        options: ["auto", "none"]
      }
    ]
  }
];
