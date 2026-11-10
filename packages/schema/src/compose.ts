import type { ElementNode } from "./element";
import { BASE_BREAKPOINT_ID } from "./breakpoint";
import type { Overlay, OverlayTemplateType, StickyHeader } from "./template";

// Layout composition: the page content goes inside <main>, with the header above and the footer
// below (docs/templates-and-themes.md 4.3). It works on plain element trees so the editor preview,
// the published site and the exporter all build the same document.

export const MAIN_ID = "main-content";
/** Attribute on the header wrapper holding the sticky settings as JSON (read by the runtime). */
export const STICKY_ATTRIBUTE = "data-nxt-sticky";

/** What the runtime reads from the sticky attribute. */
export interface StickyHeaderSpec {
  after: string;
  slideAfter: string;
  animation: string;
  duration: number;
  onScroll: boolean;
}

export function stickySpecOf(sticky: StickyHeader): StickyHeaderSpec {
  return {
    after: sticky.stickyAfter,
    slideAfter: sticky.slideAfter,
    animation: sticky.animation,
    duration: sticky.duration,
    onScroll: sticky.onScroll
  };
}

const wrapper = (
  id: string,
  tag: string,
  children: ElementNode[],
  htmlId?: string
): ElementNode => ({
  id,
  ...(htmlId ? { htmlId } : {}),
  type: "container",
  name: tag,
  htmlTag: tag,
  classIds: [],
  props: {},
  styles: { breakpoints: {} },
  actions: {},
  children
});

/** A link that jumps past the header; hidden until it gets keyboard focus (see BASE_CSS). */
const skipLink = (): ElementNode => ({
  id: "layout-skip-link",
  type: "button",
  name: "Skip to content",
  htmlTag: "a",
  classIds: ["nxt-skip-link"],
  props: { text: "Skip to content", href: `#${MAIN_ID}` },
  styles: { breakpoints: {} },
  actions: {},
  children: []
});

/**
 * The page inside its layout. Without a header or footer the page is returned as it is, so a site
 * with no templates renders exactly as before.
 */
export function composePage(
  page: ElementNode,
  header: ElementNode | null,
  footer: ElementNode | null,
  headerSticky?: StickyHeader | null
): ElementNode {
  if (!header && !footer) return page;
  const children: ElementNode[] = [];
  if (header) {
    children.push(skipLink());
    if (headerSticky?.enabled) {
      // The inner box is what sticks; the outer one keeps the header's place in the page.
      children.push({
        ...wrapper("layout-header", "header", [
          wrapper("layout-header-inner", "div", header.children)
        ]),
        attributes: { [STICKY_ATTRIBUTE]: JSON.stringify(stickySpecOf(headerSticky)) }
      });
    } else children.push(wrapper("layout-header", "header", header.children));
  }
  children.push(wrapper("layout-main", "main", page.children, MAIN_ID));
  if (footer) children.push(wrapper("layout-footer", "footer", footer.children));
  return { ...page, children };
}

/**
 * For the editor canvas: the header and footer above and below the page, as plain siblings of the
 * page content, so every page element keeps its place and parent. They are shown, not editable.
 */
export function composeForEditor(
  page: ElementNode,
  header: ElementNode | null,
  footer: ElementNode | null
): ElementNode {
  if (!header && !footer) return page;
  return {
    ...page,
    children: [
      ...(header ? [wrapper("layout-header", "header", header.children)] : []),
      ...page.children,
      ...(footer ? [wrapper("layout-footer", "footer", footer.children)] : [])
    ]
  };
}

/**
 * A modal or bottom sheet template as it looks open, for the editor canvas and the preview: the
 * root fills the window with the template's overlay behind its content, which sits centered
 * (modal) or at the bottom (sheet), like the runtime layer. Only the root's look changes, so the
 * elements keep their places and parents.
 */
export function frameOverlayTemplate(
  tree: ElementNode,
  type: OverlayTemplateType,
  overlay: Overlay
): ElementNode {
  const sheet = type === "bottom-sheet";
  const base: Record<string, string> = {
    display: "flex",
    "flex-direction": "column",
    "justify-content": sheet ? "flex-end" : "center",
    "align-items": sheet ? "stretch" : "center",
    "min-height": "100dvh"
  };
  if (!overlay.disabled) {
    base.background = `color-mix(in srgb, ${overlay.color} ${Math.round(overlay.opacity * 100)}%, transparent)`;
  }
  const existing = tree.styles.breakpoints[BASE_BREAKPOINT_ID]?.default ?? {};
  return {
    ...tree,
    styles: {
      ...tree.styles,
      breakpoints: {
        ...tree.styles.breakpoints,
        [BASE_BREAKPOINT_ID]: {
          ...tree.styles.breakpoints[BASE_BREAKPOINT_ID],
          default: { ...base, ...existing }
        }
      }
    }
  };
}

/** The shown 404 page when the project has no published 404 template. */
export function defaultNotFoundTree(root: ElementNode): ElementNode {
  const text = (id: string, tag: string, value: string): ElementNode => ({
    id,
    type: tag === "h1" ? "heading" : "text",
    name: value,
    htmlTag: tag,
    classIds: [],
    props: { text: value },
    styles: { breakpoints: {} },
    actions: {},
    children: []
  });
  return {
    ...root,
    children: [
      {
        ...wrapper("default-404", "main", [
          text("default-404-title", "h1", "404"),
          text("default-404-text", "p", "Page not found"),
          text("default-404-hint", "p", "The page you are looking for does not exist.")
        ]),
        classIds: ["nxt-404"]
      }
    ]
  };
}
