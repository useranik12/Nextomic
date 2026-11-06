"use client";

import { getStyle, type ElementNode, type PseudoState, type StyleMap } from "@nextomic/schema";
import { useEditorStore } from "../store/editor-store";

export interface DesignTarget {
  /** The class being edited, or null when the element itself is. */
  activeClass: string | null;
  breakpointId: string;
  state: PseudoState;
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
export function useDesignTarget(node: ElementNode): DesignTarget {
  const activeClass = useEditorStore((s) => s.activeClass);
  const breakpointId = useEditorStore((s) => s.activeBreakpointId);
  const state = useEditorStore((s) => s.activeState);
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
    own: (property) => getStyle(holder, breakpointId, state, property),
    inherited: (property) =>
      breakpointId === "base" ? undefined : getStyle(holder, "base", state, property),
    ownDeclarations: styles.breakpoints[breakpointId]?.[state],
    inheritedDeclarations: breakpointId === "base" ? undefined : styles.breakpoints.base?.[state]
  };
}
