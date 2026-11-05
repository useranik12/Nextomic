import type { BreakpointDef, ElementNode } from "@nextomic/schema";
import { Fragment, type ReactNode } from "react";
import { pageCss } from "./css";
import "./elements";
import { getElementDefinition } from "./registry";
import { resolveBoolean, resolveText, type TokenResolver } from "./values";

export interface RenderOptions {
  breakpoints: readonly BreakpointDef[];
  resolveToken?: TokenResolver;
}

const SAFE_ATTRIBUTE = /^(aria-[a-z-]+|data-[a-z0-9-]+|title|role|tabindex|lang|dir)$/;

function elementAttrs(node: ElementNode, options: RenderOptions): Record<string, string> {
  const attrs: Record<string, string> = { "data-nid": node.id };
  if (node.htmlId) attrs.id = node.htmlId;
  for (const [name, value] of Object.entries(node.attributes ?? {})) {
    if (SAFE_ATTRIBUTE.test(name) && name !== "data-nid") {
      attrs[name] = resolveText(value, options.resolveToken);
    }
  }
  return attrs;
}

export function renderNode(node: ElementNode, options: RenderOptions): ReactNode {
  const definition = getElementDefinition(node.type);
  if (!definition) return null;
  const children = node.children.map((child) => (
    <Fragment key={child.id}>{renderNode(child, options)}</Fragment>
  ));
  return definition.render({
    node,
    text: (key) => resolveText(node.props[key], options.resolveToken),
    bool: (key) => resolveBoolean(node.props[key]),
    attrs: elementAttrs(node, options),
    children: definition.canHaveChildren ? children : null
  });
}

/** The page tree plus the CSS for every element at every breakpoint. */
export function PageRenderer({ tree, ...options }: RenderOptions & { tree: ElementNode }) {
  const css = pageCss(tree, options.breakpoints);
  return (
    <>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {renderNode(tree, options)}
    </>
  );
}
