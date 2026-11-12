import {
  actionBlockSchema,
  overlaySchema,
  sheetEntrySchema,
  pageParamSchema,
  appStateVariableSchema,
  flowNodeSchema,
  breakpointListSchema,
  dynamicContextSchema,
  variableListSchema,
  fontListSchema,
  themeSchema,
  elementNodeSchema,
  styleMapSchema,
  timelineSchema,
  themeChoiceSchema,
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
  dynamic: dynamicContextSchema,
  // Rows of the page's query loop runs, by loop key (fetched live by the editor, memory only).
  loopRows: z
    .record(
      z.string().max(4000),
      z.object({ rows: z.array(z.unknown()).max(1000), hasMore: z.boolean() })
    )
    .default({}),
  // Auto / Show / Hide preview switch per element (conditional visibility; never saved).
  visibilityPreview: z.record(z.string().max(64), z.enum(["show", "hide"])).default({})
});
export type RenderMessage = z.infer<typeof renderMessageSchema>;

export const hostMessageSchema = z.discriminatedUnion("type", [
  renderMessageSchema,
  // Drag in progress: find the element under (x, y) in canvas coordinates and show a drop marker.
  z.object({ type: z.literal("probe"), x: finite, y: finite }),
  z.object({ type: z.literal("probe-clear") }),
  // Ask for the bounds of an element (document coordinates) so the host can fit it on screen.
  z.object({ type: z.literal("measure"), id: z.string() }),
  // Animation preview in the Animations editor: load a timeline, then play, pause, seek or stop it.
  z.object({ type: z.literal("anim-load"), timeline: timelineSchema }),
  z.object({
    type: z.literal("anim-control"),
    command: z.enum(["play", "pause", "stop", "clear"])
  }),
  z.object({ type: z.literal("anim-seek"), time: finite.min(0) }),
  // Element picking: the canvas dims the page and clears the element under the pointer.
  z.object({ type: z.literal("pick"), on: z.boolean() }),
  // Flow editor Test: run these nodes on the canvas as if a trigger of `elementId` fired.
  z.object({
    type: z.literal("test-run"),
    runId: z.string().max(64),
    elementId: z.string().max(64).nullable(),
    nodes: z.array(flowNodeSchema).max(500),
    blocks: z.array(actionBlockSchema).max(500),
    appState: z.array(appStateVariableSchema).max(500),
    routes: z.record(z.string().max(64), z.string().max(2000)),
    themes: z.array(themeChoiceSchema).max(50),
    // Modal and bottom sheet templates that can show, by id.
    overlays: z
      .record(
        z.string().max(64),
        z.object({
          type: z.enum(["modal", "bottom-sheet"]),
          tree: elementNodeSchema,
          params: z.array(pageParamSchema).max(20),
          overlay: overlaySchema,
          entry: sheetEntrySchema,
          rank: z.number().int().min(0).max(100)
        })
      )
      .refine((m) => Object.keys(m).length <= 100)
  }),
  // Ends a test: stops the run and drops the state it changed.
  z.object({ type: z.literal("test-stop") })
]);
export type HostMessage = z.infer<typeof hostMessageSchema>;

const runLogEntrySchema = z.object({
  nodeId: z.string().max(64),
  label: z.string().max(200),
  status: z.enum(["ok", "error"]),
  ms: finite.min(0),
  output: z.unknown().optional(),
  error: z.string().max(5000).optional()
});

export const canvasMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  // Flow editor Test: one finished step, then the end of the run.
  z.object({ type: z.literal("test-log"), runId: z.string().max(64), entry: runLogEntrySchema }),
  z.object({
    type: z.literal("test-done"),
    runId: z.string().max(64),
    error: z.string().max(5000).nullable()
  }),
  // Where the animation preview is, in seconds.
  z.object({
    type: z.literal("anim-state"),
    time: finite.min(0),
    duration: finite.min(0),
    playing: z.boolean()
  }),
  z.object({ type: z.literal("select"), id: z.string().nullable() }),
  // Elements whose visibility conditions fail on the canvas (the Navigator marks them).
  z.object({
    type: z.literal("conditions-failed"),
    ids: z.array(z.string().max(64)).max(10_000)
  }),
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
