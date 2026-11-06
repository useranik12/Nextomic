import {
  CLASS_NAME_PATTERN,
  createTokenResolver,
  type DynamicContext,
  themeBootScript,
  fontPreloads,
  fontsCss,
  themeCss,
  usedClassNames,
  variablesCss,
  type BreakpointDef,
  type ElementNode,
  type ProjectFont,
  type ProjectVariable,
  type StyleMap,
  type Theme
} from "@nextomic/schema";
import { Fragment, type ReactNode } from "react";
import { pageCss } from "./css";
import "./elements";
import { getElementDefinition } from "./registry";
import { resolveBoolean, resolveText, type TokenResolver } from "./values";

export interface RenderOptions {
  breakpoints: readonly BreakpointDef[];
  classes?: Readonly<Record<string, StyleMap>>;
  variables?: readonly ProjectVariable[];
  /** Project fonts; active ones become @font-face rules loading from `fontBase`. */
  fonts?: readonly ProjectFont[];
  /** URL prefix the font files are served from, no trailing slash, e.g. /fonts/<projectId>. */
  fontBase?: string;
  /** The resolved theme: its variable overrides are emitted after the base variables. */
  theme?: Theme | null;
  /** Built pages set theme and mode on <html> before first paint; the editor canvas sets them itself. */
  bootScript?: boolean;
  /**
   * Ship only the framework classes some element of the page uses. For built output (preview and
   * the published site); the editor canvas leaves it off so a class added while editing shows at once.
   */
  pruneUnusedClasses?: boolean;
  /** Class names to keep even when no element has them (classes a script or action adds later). */
  keepClasses?: readonly string[];
  /** What dynamic tags resolve to ({{page.name}}, {{param.id}}, {{now.date}} ...). */
  dynamic?: DynamicContext;
  resolveToken?: TokenResolver;
}

const SAFE_ATTRIBUTE = /^(aria-[a-z-]+|data-[a-z0-9-]+|title|role|tabindex|lang|dir)$/;

function elementAttrs(node: ElementNode, options: RenderOptions): Record<string, string> {
  const attrs: Record<string, string> = { "data-nid": node.id };
  if (node.htmlId) attrs.id = node.htmlId;
  const classes = node.classIds.filter((name) => CLASS_NAME_PATTERN.test(name));
  if (classes.length > 0) attrs.className = classes.join(" ");
  for (const [name, value] of Object.entries(node.attributes ?? {})) {
    if (SAFE_ATTRIBUTE.test(name) && name !== "data-nid") {
      attrs[name] = resolveText(value, options.resolveToken);
    }
  }
  return attrs;
}

export function renderNode(node: ElementNode, options: RenderOptions): ReactNode {
  const definition = getElementDefinition(node.type);
  if (!definition || node.hidden) return null;
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
export function PageRenderer({ tree, ...given }: RenderOptions & { tree: ElementNode }) {
  const options: RenderOptions = {
    ...given,
    resolveToken:
      given.resolveToken ?? (given.dynamic ? createTokenResolver(given.dynamic) : undefined)
  };
  const fontBase = options.fontBase ?? "";
  const used = options.pruneUnusedClasses
    ? new Set([...usedClassNames(tree), ...(options.keepClasses ?? [])])
    : undefined;
  const css =
    fontsCss(options.fonts ?? [], fontBase) +
    variablesCss(options.variables ?? []) +
    (options.theme ? themeCss(options.theme, used) : "") +
    pageCss(tree, options.breakpoints, options.classes);
  return (
    <>
      {options.theme && options.bootScript ? (
        <script dangerouslySetInnerHTML={{ __html: themeBootScript(options.theme) }} />
      ) : null}
      {options.bootScript
        ? fontPreloads(options.fonts ?? [], fontBase).map((p) => (
            <link key={p.href} rel="preload" as="font" type={p.type} href={p.href} crossOrigin="" />
          ))
        : null}
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {renderNode(tree, options)}
    </>
  );
}
