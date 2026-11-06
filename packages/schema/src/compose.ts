import type { ElementNode } from "./element";

// Layout composition: the page content goes inside <main>, with the header above and the footer
// below (docs/templates-and-themes.md 4.3). It works on plain element trees so the editor preview,
// the published site and the exporter all build the same document.

export const MAIN_ID = "main-content";

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
  footer: ElementNode | null
): ElementNode {
  if (!header && !footer) return page;
  const children: ElementNode[] = [];
  if (header) {
    children.push(skipLink());
    children.push(wrapper("layout-header", "header", header.children));
  }
  children.push(wrapper("layout-main", "main", page.children, MAIN_ID));
  if (footer) children.push(wrapper("layout-footer", "footer", footer.children));
  return { ...page, children };
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
