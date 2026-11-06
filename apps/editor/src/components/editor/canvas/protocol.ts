import {
  breakpointListSchema,
  dynamicContextSchema,
  variableListSchema,
  fontListSchema,
  themeSchema,
  elementNodeSchema,
  styleMapSchema,
  type BreakpointDef,
  type ElementNode,
  type ProjectVariable,
  type StyleMap,
  type Theme
} from "@nextomic/schema";
import { z } from "zod";

// Messages between the editor and the sandboxed canvas iframe. The iframe has an opaque origin
// (no allow-same-origin), so it holds no cookies and can only talk through postMessage. Both sides
// check `event.source` and validate every payload.

const finite = z.number().finite();

export const dropZoneSchema = z.enum(["before", "inside", "after"]);

export const renderMessageSchema = z.object({
  type: z.literal("render"),
  tree: elementNodeSchema,
  breakpoints: breakpointListSchema,
  classes: z.record(z.string(), styleMapSchema),
  variables: variableListSchema,
  fonts: fontListSchema,
  // URL prefix the font files load from, e.g. /fonts/<projectId>.
  fontBase: z.string().regex(/^\/fonts\/[A-Za-z0-9_-]+$/),
  theme: themeSchema.nullable(),
  // Custom CSS files that apply to this page, joined in order.
  customCss: z.string().max(10_000_000).default(""),
  // A mode id of the active theme (light and dark unless the theme defines others).
  mode: z.string().max(32),
  selectedId: z.string().nullable(),
  // Hide the selection outline (Border settings are being edited).
  hideSelection: z.boolean().default(false),
  // What dynamic tags show: the page, its parameter defaults, state, date and time.
  dynamic: dynamicContextSchema
});
export type RenderMessage = z.infer<typeof renderMessageSchema>;

export const hostMessageSchema = z.discriminatedUnion("type", [
  renderMessageSchema,
  // Drag in progress: find the element under (x, y) in canvas coordinates and show a drop marker.
  z.object({ type: z.literal("probe"), x: finite, y: finite }),
  z.object({ type: z.literal("probe-clear") }),
  // Ask for the bounds of an element (document coordinates) so the host can fit it on screen.
  z.object({ type: z.literal("measure"), id: z.string() })
]);
export type HostMessage = z.infer<typeof hostMessageSchema>;

export const canvasMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("select"), id: z.string().nullable() }),
  // Right-click on an element; coordinates are inside the canvas document.
  z.object({ type: z.literal("context"), id: z.string(), clientX: finite, clientY: finite }),
  // Document height so the frame can grow to the page and the canvas pans instead of scrolling.
  z.object({ type: z.literal("size"), height: finite.min(0).max(100_000) }),
  // Wheel and middle-button gestures happen over the iframe, so it forwards them to the host.
  z.object({
    type: z.literal("wheel"),
    clientX: finite,
    clientY: finite,
    deltaX: finite,
    deltaY: finite,
    shift: z.boolean()
  }),
  z.object({
    type: z.literal("pan"),
    phase: z.enum(["start", "move", "end"]),
    screenX: finite,
    screenY: finite
  }),
  z.object({
    type: z.literal("measure-result"),
    id: z.string(),
    x: finite,
    y: finite,
    width: finite.min(0),
    height: finite.min(0)
  }),
  z.object({
    type: z.literal("probe-result"),
    id: z.string().nullable(),
    zone: dropZoneSchema
  })
]);
export type CanvasMessage = z.infer<typeof canvasMessageSchema>;

export interface RenderPayload {
  tree: ElementNode;
  breakpoints: BreakpointDef[];
  classes: Record<string, StyleMap>;
  variables: ProjectVariable[];
  theme: Theme | null;
  customCss: string;
  mode: string;
  selectedId: string | null;
  hideSelection: boolean;
}
