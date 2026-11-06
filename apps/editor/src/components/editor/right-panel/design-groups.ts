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
  /** Shown at half width beside the next half-width property (min and max width, the two gaps). */
  half?: boolean;
  /** Settings with the same cluster id sit close together; clusters are spaced further apart. */
  cluster?: string;
  /** A visual editor in a popover instead of a text field. */
  editor?: "transform" | "filter" | "backdrop-filter";
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
        cluster: "align",
        label: "Display",
        options: ["block", "flex", "grid", "inline", "inline-block", "none"]
      },
      {
        property: "flex-wrap",
        label: "Flex wrap",
        cluster: "align",
        options: ["nowrap", "wrap", "wrap-reverse"]
      },
      { property: "gap", label: "Gap", placeholder: "16px", cluster: "gaps" },
      {
        property: "column-gap",
        label: "Column gap",
        placeholder: "normal",
        half: true,
        cluster: "gaps"
      },
      { property: "row-gap", label: "Row gap", placeholder: "normal", half: true, cluster: "gaps" },
      {
        property: "flex-direction",
        cluster: "align",
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
        cluster: "align",
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
        cluster: "align",
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
        cluster: "align",
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
      { property: "flex-grow", label: "Flex grow", placeholder: "0", half: true, cluster: "flex" },
      {
        property: "flex-shrink",
        label: "Flex shrink",
        placeholder: "1",
        half: true,
        cluster: "flex"
      },
      { property: "flex-basis", label: "Flex basis", placeholder: "auto", cluster: "flex" },
      { property: "order", label: "Order", placeholder: "0", cluster: "flex" }
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
      { property: "width", label: "Width", placeholder: "100%", cluster: "width" },
      { property: "min-width", label: "Min width", placeholder: "0", half: true, cluster: "width" },
      {
        property: "max-width",
        label: "Max width",
        placeholder: "1200px",
        half: true,
        cluster: "width"
      },
      { property: "height", label: "Height", placeholder: "auto", cluster: "height" },
      {
        property: "min-height",
        label: "Min height",
        placeholder: "0",
        half: true,
        cluster: "height"
      },
      {
        property: "max-height",
        label: "Max height",
        placeholder: "none",
        half: true,
        cluster: "height"
      },
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
        cluster: "font",
        label: "Font family",
        placeholder: "system-ui, sans-serif",
        tip: "Pick one of your project fonts or a system font. The weights and styles below follow the font you choose."
      },
      { property: "font-size", cluster: "font", label: "Font size", placeholder: "16" },
      {
        property: "font-weight",
        cluster: "font",
        label: "Font weight",
        fontOption: "weight",
        options: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
        tip: "Only the weights installed for this font are listed."
      },
      {
        property: "font-style",
        cluster: "font",
        label: "Font style",
        fontOption: "style",
        options: ["normal", "italic", "oblique"],
        tip: "Italic appears only when the font has an italic face installed."
      },
      { property: "line-height", cluster: "rhythm", label: "Line height", placeholder: "1.5" },
      {
        property: "text-align",
        cluster: "text",
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
      { property: "letter-spacing", cluster: "rhythm", label: "Letter spacing", placeholder: "0" },
      {
        property: "text-transform",
        cluster: "text",
        label: "Transform",
        options: ["none", "uppercase", "lowercase", "capitalize"]
      },
      {
        property: "text-decoration-line",
        cluster: "text",
        label: "Decoration",
        options: ["none", "underline", "line-through", "overline"]
      },
      {
        property: "white-space",
        cluster: "text",
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
        cluster: "image",
        label: "Image",
        placeholder: "url(...) or linear-gradient(...)"
      },
      {
        property: "background-size",
        cluster: "image",
        label: "Size",
        options: ["auto", "cover", "contain"]
      },
      {
        property: "background-position",
        cluster: "image",
        label: "Position",
        placeholder: "center"
      },
      {
        property: "background-repeat",
        cluster: "image",
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
        cluster: "edge",
        label: "Border width",
        sides: "border-width",
        tip: "The thickness of each edge. A border shows only when the style is not none."
      },
      {
        property: "border-style",
        cluster: "edge",
        label: "Border style",
        options: ["none", "solid", "dashed", "dotted", "double"]
      },
      { property: "border-color", cluster: "edge", label: "Border color", placeholder: "#cccccc" },
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
      {
        property: "cursor",
        label: "Cursor",
        cluster: "interact",
        options: ["auto", "pointer", "default", "not-allowed", "grab", "text"]
      },
      {
        property: "pointer-events",
        label: "Pointer events",
        cluster: "interact",
        options: ["auto", "none"]
      }
    ]
  },
  {
    id: "transform",
    label: "Transform",
    icon: "group-transform",
    properties: [
      {
        property: "transform",
        label: "Transform",
        editor: "transform",
        placeholder: "translateY(-2px)",
        tip: "Move, scale, rotate, skew and add perspective. Open the editor with the icon; the CSS text stays available."
      },
      { property: "transform-origin", label: "Transform origin", placeholder: "50% 50%" },
      {
        property: "transform-style",
        label: "Transform style",
        options: ["flat", "preserve-3d"]
      },
      {
        property: "transform-box",
        label: "Transform box",
        options: ["content-box", "border-box", "fill-box", "stroke-box", "view-box"]
      }
    ]
  },
  {
    id: "filters",
    label: "Filters and transition",
    icon: "group-filters",
    properties: [
      {
        property: "filter",
        label: "CSS filters",
        editor: "filter",
        placeholder: "blur(4px)",
        tip: "Blur, brightness, contrast, hue, invert, opacity, saturation and sepia, with sliders."
      },
      {
        property: "backdrop-filter",
        label: "Backdrop filter",
        editor: "backdrop-filter",
        placeholder: "blur(8px)",
        tip: "The same filters, applied to what is behind the element."
      },
      { property: "transition", label: "Transition", placeholder: "all 300ms ease" }
    ]
  }
];
