"use client";

import {
  getStyle,
  pseudoOf,
  type EditState,
  type ElementNode,
  type PseudoState,
  type StyleMap
} from "@nextomic/schema";
import { useEditorStore } from "../store/editor-store";

export interface DesignTarget {
  /** The class being edited, or null when the element itself is. */
  activeClass: string | null;
  breakpointId: string;
  state: EditState;
  styles: StyleMap;
  /** The value of a property set on this target at the current breakpoint and state. */
  own: (property: string) => string | undefined;
  /** The same property at the base breakpoint, shown dimmed while another breakpoint is open. */
  inherited: (property: string) => string | undefined;
  /** All declarations set here, at the current breakpoint and state. */
  ownDeclarations: Readonly<Record<string, string>> | undefined;
  inheritedDeclarations: Readonly<Record<string, string>> | undefined;
}

/**
 * What the Design tab edits: the selected class when one is active, else the element. Reading from
 * the target (not always the element) keeps the fields in step with where changes are written.
 */
export function useDesignTarget(node: ElementNode, pinned?: PseudoState): DesignTarget {
  const activeClass = useEditorStore((s) => s.activeClass);
  const breakpointId = useEditorStore((s) => s.activeBreakpointId);
  const globalState = useEditorStore((s) => s.activeState);
  const state: EditState = pinned ?? globalState;
  // Form-only states hold no ordinary settings (they live in the Form design group).
  const pseudo = pseudoOf(state);
  const classStyles = useEditorStore((s) =>
    s.activeClass ? s.project.classes[s.activeClass] : undefined
  );
  const styles: StyleMap = activeClass ? (classStyles ?? { breakpoints: {} }) : node.styles;
  const holder = { styles };
  return {
    activeClass,
    breakpointId,
    state,
    styles,
    own: (property) => (pseudo ? getStyle(holder, breakpointId, pseudo, property) : undefined),
    inherited: (property) =>
      breakpointId === "base" || !pseudo ? undefined : getStyle(holder, "base", pseudo, property),
    ownDeclarations: pseudo ? styles.breakpoints[breakpointId]?.[pseudo] : undefined,
    inheritedDeclarations:
      breakpointId === "base" || !pseudo ? undefined : styles.breakpoints.base?.[pseudo]
  };
}
