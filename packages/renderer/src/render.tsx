import {
  activeQuery,
  CLASS_NAME_PATTERN,
  loopFrame,
  loopKey,
  URL_ATTRIBUTES,
  createTokenResolver,
  isAllowedAttribute,
  type DynamicContext,
  themeBootScript,
  fontPreloads,
  fontsCss,
  themeCss,
  usedClassNames,
  variablesCss,
  type BreakpointDef,
  type LoopFrame,
  type LoopRows,
  type LoopStep,
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
import { resolveBoolean, resolveText, safeUrl, type TokenResolver } from "./values";

export interface RenderOptions {
  breakpoints: readonly BreakpointDef[];
  classes?: Readonly<Record<string, StyleMap>>;
  variables?: readonly ProjectVariable[];
  /** Custom CSS files of the page, already filtered and joined (schema `customCssFor`). Written after the theme. */
  customCss?: string;
  /** Project fonts; active ones become @font-face rules loading from `fontBase`. */
  fonts?: readonly ProjectFont[];
  /** URL prefix the font files are served from, no trailing slash, e.g. /fonts/<projectId>. */
  fontBase?: string;
  /** The resolved theme: its variable overrides are emitted after the base variables. */
  theme?: Theme | null;
  /**
   * Published sites load the theme's CSS from this stylesheet URL (one cacheable file per theme)
   * instead of writing it into the page. The editor canvas and the preview keep it inline.
   */
  themeStylesheet?: string;
  /** Built pages set theme and mode on <html> before first paint; the editor canvas sets them itself. */
  bootScript?: boolean;
  /**
   * Ship only the framework classes some element of the page uses. For built output (preview and
   * the published site); the editor canvas leaves it off so a class added while editing shows at once.
   */
  pruneUnusedClasses?: boolean;
  /** Class names to keep even when no element has them (classes a script or action adds later). */
  keepClasses?: readonly string[];
  /** Rows of each query loop run, by `loopKey` (fetched before rendering: server or canvas). */
  loopRows?: LoopRows;
  /**
   * Editor canvas: a loop whose rows have not arrived shows its children once with an empty row,
   * so they stay visible and selectable. Elsewhere such a loop renders no children.
   */
  loopPlaceholder?: boolean;
  /**
   * Built pages: mark loop elements and the top elements of each copy with data attributes the
   * client runtime reads (`data-nx-loop` key, row count, more rows, infinite scroll, realtime
   * table; `data-nx-row` position).
   */
  loopMarkers?: boolean;
  /** What dynamic tags resolve to ({{page.name}}, {{param.id}}, {{now.date}} ...). */
  dynamic?: DynamicContext;
  resolveToken?: TokenResolver;
}

const BOOLEAN_ATTRIBUTES = new Set([
  "required",
  "disabled",
  "readonly",
  "checked",
  "selected",
  "multiple",
  "hidden",
  "autofocus"
]);

/** Where an element renders: the loop rows around it and the resolver that sees them. */
interface RenderScope {
  path: LoopStep[];
  frames: LoopFrame[];
  resolveToken: TokenResolver | undefined;
  /** Set on the top elements of one loop copy: the row position they show. */
  row?: number;
}

function elementAttrs(
  node: ElementNode,
  resolveToken: TokenResolver | undefined
): Record<string, string> {
  const attrs: Record<string, string> = { "data-nid": node.id };
  if (node.htmlId) attrs.id = node.htmlId;
  const classes = node.classIds.filter((name) => CLASS_NAME_PATTERN.test(name));
  if (classes.length > 0) attrs.className = classes.join(" ");
  for (const [name, value] of Object.entries(node.attributes ?? {})) {
    if (!isAllowedAttribute(name)) continue;
    const text = resolveText(value, resolveToken);
    if (BOOLEAN_ATTRIBUTES.has(name)) {
      // A switch attribute is on when it is empty or "true"; "false" leaves it off.
      if (text !== "false") attrs[name] = "true";
    } else if (URL_ATTRIBUTES.has(name)) {
      const url = safeUrl(text);
      if (url !== "") attrs[name] = url;
    } else attrs[name] = text;
  }
  return attrs;
}

/** A resolver that also sees the loop rows (needs `dynamic`; a given `resolveToken` cannot). */
function loopResolver(options: RenderOptions, frames: LoopFrame[]): TokenResolver | undefined {
  return options.dynamic ? createTokenResolver(options.dynamic, frames) : options.resolveToken;
}

/**
 * The children of an element. A query loop element repeats them once per row of its run, each
 * copy reading its row as `item` and its position as `index` (outer loops become `parent`).
 */
function renderChildren(node: ElementNode, options: RenderOptions, scope: RenderScope): ReactNode {
  const copy = (inner: RenderScope, suffix: string) =>
    node.children.map((child) => (
      <Fragment key={child.id + suffix}>{renderScoped(child, options, inner)}</Fragment>
    ));
  if (!activeQuery(node)) return copy({ ...scope, row: undefined }, "");
  const result = options.loopRows?.[loopKey(scope.path, node.id)];
  const rows = result ? result.rows : options.loopPlaceholder ? [{}] : [];
  return rows.map((item, index) => {
    const frames = [loopFrame(node, item, index), ...scope.frames];
    return copy(
      {
        path: [...scope.path, { id: node.id, index }],
        frames,
        resolveToken: loopResolver(options, frames),
        row: index
      },
      `#${index}`
    );
  });
}

/** The data attributes the client runtime reads (only with `loopMarkers`). */
function loopMarkers(
  node: ElementNode,
  options: RenderOptions,
  scope: RenderScope
): Record<string, string> {
  const marks: Record<string, string> = {};
  if (scope.row !== undefined) marks["data-nx-row"] = String(scope.row);
  const query = activeQuery(node);
  if (!query) return marks;
  const key = loopKey(scope.path, node.id);
  const result = options.loopRows?.[key];
  marks["data-nx-loop"] = key;
  // Rows may be a sparse list (a later page): count what is there.
  marks["data-nx-count"] = String(result ? result.rows.filter(() => true).length : 0);
  marks["data-nx-more"] = result?.hasMore ? "1" : "0";
  const settings = query.source === "supabase" ? query.supabase : query.rest;
  if (settings.infiniteScroll && !settings.single) marks["data-nx-scroll"] = "";
  if (query.source === "supabase" && query.supabase.realtime && query.supabase.table)
    marks["data-nx-realtime"] = `${query.supabase.schema}.${query.supabase.table}`;
  return marks;
}

function renderScoped(node: ElementNode, options: RenderOptions, scope: RenderScope): ReactNode {
  const definition = getElementDefinition(node.type);
  if (!definition || node.hidden) return null;
  const attrs = elementAttrs(node, scope.resolveToken);
  return definition.render({
    node,
    text: (key) => resolveText(node.props[key], scope.resolveToken),
    bool: (key) => resolveBoolean(node.props[key]),
    attrs: options.loopMarkers ? { ...attrs, ...loopMarkers(node, options, scope) } : attrs,
    children: definition.canHaveChildren ? renderChildren(node, options, scope) : null
  });
}

export function renderNode(node: ElementNode, options: RenderOptions): ReactNode {
  return renderScoped(node, options, { path: [], frames: [], resolveToken: options.resolveToken });
}

/**
 * The copies of one loop run on their own, without the loop element (the next page of an
 * infinite scroll, or the rows again after a realtime change). `path` and `frames` place the run
 * inside its outer loops; `options.loopRows` holds its rows (sparse for a later page) and those
 * of loops nested in it.
 */
export function renderLoopCopies(
  node: ElementNode,
  given: RenderOptions,
  start: { path: LoopStep[]; frames: LoopFrame[] }
): ReactNode {
  const options: RenderOptions = {
    ...given,
    resolveToken:
      given.resolveToken ?? (given.dynamic ? createTokenResolver(given.dynamic) : undefined)
  };
  return renderChildren(node, options, {
    ...start,
    resolveToken: loopResolver(options, start.frames)
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
  const linkTheme = Boolean(options.theme && options.themeStylesheet);
  // The cascade is fonts, variables, theme, custom CSS files, classes, elements. With the theme in
  // its own file the page style splits around the link so the order stays the same.
  const head =
    fontsCss(options.fonts ?? [], fontBase) +
    variablesCss(options.variables ?? []) +
    (options.theme && !linkTheme ? themeCss(options.theme, used) : "");
  const tail =
    (options.customCss ?? "") +
    pageCss(tree, options.breakpoints, options.classes, options.resolveToken);
  const css = head + (linkTheme ? "" : tail);
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
      {linkTheme ? <link rel="stylesheet" href={options.themeStylesheet} /> : null}
      {linkTheme && tail ? <style dangerouslySetInnerHTML={{ __html: tail }} /> : null}
      {renderNode(tree, options)}
    </>
  );
}
