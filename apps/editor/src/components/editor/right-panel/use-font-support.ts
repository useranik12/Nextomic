"use client";

import {
  fontSupportFor,
  findNode,
  variableCssName,
  type ElementNode,
  type FontSupport,
  type ProjectSettings
} from "@nextomic/schema";
import { useEditorStore } from "../store/editor-store";
import { useDesignTarget } from "./use-design-target";

const FONT_FAMILY = "font-family";

type Classes = ProjectSettings["classes"];

/** A font-family set by an element's own styles or its classes at the base breakpoint, if any. */
function familyOf(node: ElementNode, classes: Classes): string | undefined {
  const own = node.styles.breakpoints.base?.default?.[FONT_FAMILY];
  if (own) return own;
  for (const name of [...node.classIds].reverse()) {
    const fromClass = classes[name]?.breakpoints.base?.default?.[FONT_FAMILY];
    if (fromClass) return fromClass;
  }
  return undefined;
}

/**
 * The font stack the selected element is drawn in: what is set on the target, else what its
 * classes and ancestors set (text inherits its font), with a font variable followed to its value.
 */
export function useEffectiveFontStack(node: ElementNode): string | undefined {
  const target = useDesignTarget(node);
  const tree = useEditorStore((s) => s.doc?.tree);
  const classes = useEditorStore((s) => s.project.classes);
  const variables = useEditorStore((s) => s.project.variables);

  let stack: string | undefined = target.own(FONT_FAMILY) ?? target.inherited(FONT_FAMILY);
  if (!stack) stack = familyOf(node, classes);
  if (!stack && tree) {
    let at = findNode(tree, node.id)?.parent ?? null;
    while (at && !stack) {
      stack = familyOf(at, classes);
      at = findNode(tree, at.id)?.parent ?? null;
    }
  }
  const ref = /^var\((--[A-Za-z0-9_-]+)\)$/.exec(stack?.trim() ?? "");
  if (ref) {
    const found = variables.find((v) => variableCssName(v.name) === ref[1]);
    stack = found?.value;
  }
  return stack;
}

/** What the font in use can draw; null when it is a system font or none is set (nothing is hidden). */
export function useFontSupport(node: ElementNode): FontSupport | null {
  const stack = useEffectiveFontStack(node);
  const fonts = useEditorStore((s) => s.project.fonts);
  return fontSupportFor(fonts, stack);
}
