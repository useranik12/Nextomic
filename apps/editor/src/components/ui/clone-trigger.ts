import { mergeProps } from "react-aria";
import { cloneElement, type HTMLAttributes, type ReactElement } from "react";

/**
 * Renders a trigger as the caller's own element: the overlay's press, aria and ref props are merged
 * onto it. The trigger's own children stay (an overlay passes none of its own), and a prop the
 * overlay leaves `undefined` never erases one the element already has.
 */
export function cloneTrigger(
  child: ReactElement<Record<string, unknown>>,
  props: HTMLAttributes<HTMLElement>
): ReactElement {
  const { children: _children, ...rest } = props;
  const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  return cloneElement(child, mergeProps(child.props, defined));
}
