import type { ElementNode, MediaKind, PropValue } from "@nextomic/schema";
import type { ReactNode } from "react";
import type { ZodObject, ZodRawShape } from "zod";

export type ElementCategory = "layout" | "basic";

export type ControlKind = "text" | "textarea" | "url" | "select" | "switch" | "icon";

export interface ControlDef {
  key: string;
  label: string;
  kind: ControlKind;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Adds a "Choose from Media" button; the picker only lists these kinds of file. */
  pick?: MediaKind[];
  /** Shows the control only while another prop has this value (for example the Icon source). */
  when?: { key: string; value: string };
  /** `icon` controls: the prop that holds the library key (`key` holds the icon name). */
  libraryKey?: string;
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
  /** A library icon drawn as inline SVG or an icon-font class; null when it is not known. */
  icon: (
    library: string,
    name: string,
    options?: { size?: string; label?: string }
  ) => IconDraw | null;
}

export type IconDraw = { kind: "svg"; html: string } | { kind: "font"; className: string };

/** What the page knows about icon libraries; filled by the server or the canvas before rendering. */
export interface IconLookup {
  /** Sanitized inline SVG for a library icon, or null when the icon is not known. */
  svg: (library: string, name: string, options: { size: string; label: string }) => string | null;
  /** True when the library is an uploaded icon font that has this glyph (drawn with a class). */
  font: (library: string, name: string) => boolean;
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
