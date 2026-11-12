import { mediaSrcSet } from "@nextomic/schema";
import { createElement } from "react";
import { z } from "zod";
import { registerElement, type ControlDef } from "./registry";
import { safeUrl } from "./values";

const LAYOUT_TAGS = ["div", "section", "header", "main", "nav", "aside", "article", "footer"];

const BUTTON_TAGS = ["button", "a", "div", "span"];

const tagControl = (tags: string[]): ControlDef => ({
  key: "htmlTag",
  label: "HTML tag",
  kind: "select",
  options: tags.map((tag) => ({ value: tag, label: tag }))
});

registerElement({
  type: "page",
  label: "Page",
  category: "layout",
  hidden: true,
  canHaveChildren: true,
  defaults: () => ({ props: {}, name: "Page" }),
  propsSchema: z.object({}),
  controls: [],
  bindable: {},
  render: ({ attrs, children }) => createElement("div", attrs, children)
});

registerElement({
  type: "section",
  label: "Section",
  category: "layout",
  canHaveChildren: true,
  htmlTags: ["section", ...LAYOUT_TAGS.filter((tag) => tag !== "section")],
  defaults: () => ({ props: {}, htmlTag: "section", name: "Section" }),
  propsSchema: z.object({}),
  controls: [tagControl(["section", ...LAYOUT_TAGS.filter((tag) => tag !== "section")])],
  bindable: {},
  render: ({ node, attrs, children }) => createElement(node.htmlTag ?? "section", attrs, children)
});

registerElement({
  type: "container",
  label: "Container",
  category: "layout",
  canHaveChildren: true,
  htmlTags: LAYOUT_TAGS,
  defaults: () => ({ props: {}, htmlTag: "div", name: "Container" }),
  propsSchema: z.object({}),
  controls: [tagControl(LAYOUT_TAGS)],
  bindable: {},
  render: ({ node, attrs, children }) => createElement(node.htmlTag ?? "div", attrs, children)
});

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];

registerElement({
  type: "heading",
  label: "Heading",
  category: "basic",
  canHaveChildren: false,
  htmlTags: HEADING_TAGS,
  defaults: () => ({ props: { text: "Heading" }, htmlTag: "h2", name: "Heading" }),
  propsSchema: z.object({ text: z.string() }),
  controls: [{ key: "text", label: "Text", kind: "textarea" }, tagControl(HEADING_TAGS)],
  bindable: { text: true },
  render: ({ node, attrs, text }) => createElement(node.htmlTag ?? "h2", attrs, text("text"))
});

registerElement({
  type: "text",
  label: "Simple Text",
  category: "basic",
  canHaveChildren: false,
  htmlTags: ["p", "span", "div"],
  defaults: () => ({
    props: { text: "Write something here." },
    htmlTag: "p",
    name: "Text"
  }),
  propsSchema: z.object({ text: z.string() }),
  controls: [{ key: "text", label: "Text", kind: "textarea" }, tagControl(["p", "span", "div"])],
  bindable: { text: true },
  render: ({ node, attrs, text }) => createElement(node.htmlTag ?? "p", attrs, text("text"))
});

registerElement({
  type: "button",
  label: "Button",
  category: "basic",
  canHaveChildren: false,
  htmlTags: BUTTON_TAGS,
  defaults: () => ({ props: { text: "Button", href: "" }, htmlTag: "button", name: "Button" }),
  propsSchema: z.object({ text: z.string(), href: z.string() }),
  controls: [
    { key: "text", label: "Text", kind: "text" },
    tagControl(BUTTON_TAGS),
    { key: "href", label: "Link", kind: "url", placeholder: "https:// or /page" }
  ],
  bindable: { text: true, href: true },
  render: ({ node, attrs, text }) => {
    const href = safeUrl(text("href"));
    const tag = node.htmlTag ?? "button";
    // A button or link with an address is a link; a button without one stays a button.
    if (tag === "a" || (tag === "button" && href)) {
      return createElement("a", href ? { ...attrs, href } : attrs, text("text"));
    }
    return createElement(
      tag,
      tag === "button" ? { ...attrs, type: "button" } : attrs,
      text("text")
    );
  }
});

registerElement({
  type: "image",
  label: "Image",
  category: "basic",
  canHaveChildren: false,
  defaults: () => ({ props: { src: "", alt: "" }, name: "Image" }),
  propsSchema: z.object({ src: z.string(), alt: z.string() }),
  controls: [
    {
      key: "src",
      label: "Source URL",
      kind: "url",
      placeholder: "https://...",
      pick: ["image", "svg"]
    },
    { key: "alt", label: "Alt text", kind: "text" }
  ],
  bindable: { src: true, alt: true },
  render: ({ attrs, text }) => {
    const src = safeUrl(text("src"));
    // A file from Media gets resized copies to choose from; the original stays the fallback `src`.
    const srcSet = mediaSrcSet(src);
    return createElement("img", {
      ...attrs,
      src: src === "" ? undefined : src,
      ...(srcSet && !attrs.srcset ? { srcSet } : {}),
      alt: text("alt")
    });
  }
});
