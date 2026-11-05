import {
  breakpointListSchema,
  elementNodeSchema,
  type BreakpointDef,
  type ElementNode
} from "@nextomic/schema";
import { z } from "zod";

// Messages between the editor and the sandboxed canvas iframe. The iframe has an opaque origin
// (no allow-same-origin), so it holds no cookies and can only talk through postMessage. Both sides
// check `event.source` and validate every payload.

export const hostMessageSchema = z.object({
  type: z.literal("render"),
  tree: elementNodeSchema,
  breakpoints: breakpointListSchema,
  mode: z.enum(["light", "dark"]),
  selectedId: z.string().nullable()
});
export type HostMessage = z.infer<typeof hostMessageSchema>;

export const canvasMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("select"), id: z.string().nullable() })
]);
export type CanvasMessage = z.infer<typeof canvasMessageSchema>;

export interface RenderPayload {
  tree: ElementNode;
  breakpoints: BreakpointDef[];
  mode: "light" | "dark";
  selectedId: string | null;
}
