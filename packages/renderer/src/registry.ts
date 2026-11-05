import type { ElementNode, PropValue } from "@nextomic/schema";
import type { ReactNode } from "react";
import type { ZodObject, ZodRawShape } from "zod";

export type ElementCategory = "layout" | "basic";

export type ControlKind = "text" | "textarea" | "url" | "select" | "switch";

export interface ControlDef {
  key: string;
  label: string;
  kind: ControlKind;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

// `true`: accepts static text mixed with dynamic tokens. `{ reason }`: opted out, with a written reason.
export type BindableFlag = true | { reason: string };

export interface RenderContext {
  node: ElementNode;
  /** Resolved text for a prop (static or mixed text). */
  text: (key: string) => string;
  bool: (key: string) => boolean;
  /** Attributes every element receives (data-nid, id, custom attributes). */
  attrs: Record<string, string>;
  children: ReactNode;
}

export interface ElementDefinition {
  type: string;
  label: string;
  category: ElementCategory;
  /** Hidden from the Elements flyout (the page root). */
  hidden?: boolean;
  canHaveChildren: boolean;
  /** Tags the user may pick for `htmlTag` (first one is the default). */
  htmlTags?: string[];
  defaults: () => { props: Record<string, PropValue>; htmlTag?: string; name: string };
  propsSchema: ZodObject<ZodRawShape>;
  controls: ControlDef[];
  bindable: Record<string, BindableFlag>;
  /** Next/React render, used by the canvas, preview and the Next exporter. */
  render: (ctx: RenderContext) => ReactNode;
}

const definitions = new Map<string, ElementDefinition>();

export function registerElement(definition: ElementDefinition): void {
  const missing = Object.keys(definition.propsSchema.shape).filter(
    (key) => definition.bindable[key] === undefined
  );
  if (missing.length > 0) {
    throw new Error(
      `Element "${definition.type}" does not mark props as bindable: ${missing.join(", ")}`
    );
  }
  const unknownBindable = Object.keys(definition.bindable).filter(
    (key) => !(key in definition.propsSchema.shape)
  );
  if (unknownBindable.length > 0) {
    throw new Error(
      `Element "${definition.type}" marks unknown props: ${unknownBindable.join(", ")}`
    );
  }
  definitions.set(definition.type, definition);
}

export function getElementDefinition(type: string): ElementDefinition | undefined {
  return definitions.get(type);
}

export function listElementDefinitions(): ElementDefinition[] {
  return [...definitions.values()];
}
