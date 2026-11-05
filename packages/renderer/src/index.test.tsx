import { DEFAULT_BREAKPOINTS, emptyPageTree, type ElementNode } from "@nextomic/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PageRenderer,
  elementCss,
  getElementDefinition,
  hasStylesAt,
  isSafeCssValue,
  listElementDefinitions,
  registerElement,
  resolveText,
  safeUrl
} from "./index";
import { z } from "zod";

function node(partial: Partial<ElementNode> & Pick<ElementNode, "id" | "type">): ElementNode {
  return {
    classIds: [],
    props: {},
    styles: { breakpoints: {} },
    actions: {},
    children: [],
    ...partial
  };
}

describe("registry", () => {
  it("registers the starter elements", () => {
    const types = listElementDefinitions().map((d) => d.type);
    expect(types).toEqual(["page", "section", "container", "heading", "text", "button", "image"]);
  });

  it("marks every prop as bindable or opted out", () => {
    for (const def of listElementDefinitions()) {
      for (const key of Object.keys(def.propsSchema.shape)) {
        expect(def.bindable[key], `${def.type}.${key}`).toBeDefined();
      }
    }
  });

  it("refuses an element with an unmarked prop", () => {
    expect(() =>
      registerElement({
        ...getElementDefinition("heading")!,
        type: "broken",
        propsSchema: z.object({ text: z.string(), extra: z.string() })
      })
    ).toThrow(/extra/);
  });

  it("builds defaults that satisfy their own props schema", () => {
    for (const def of listElementDefinitions()) {
      expect(def.propsSchema.safeParse(def.defaults().props).success, def.type).toBe(true);
    }
  });
});

describe("values", () => {
  it("flattens mixed text and resolves tokens", () => {
    const value = { kind: "mixed" as const, parts: ["Hi ", { token: "user.name" }] };
    expect(resolveText(value, (token) => (token === "user.name" ? "Ada" : ""))).toBe("Hi Ada");
    expect(resolveText(value)).toBe("Hi ");
  });

  it("blocks unsafe URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("https://a.dev")).toBe("https://a.dev");
    expect(safeUrl("/about")).toBe("/about");
    expect(safeUrl("about")).toBe("about");
  });
});

describe("css", () => {
  const tree = node({
    id: "n1",
    type: "container",
    styles: {
      breakpoints: {
        base: { default: { color: "red" }, hover: { color: "blue" } },
        tablet: { default: { color: "green" } },
        mobile: { default: { color: "pink" } }
      }
    }
  });

  it("emits base first then down breakpoints largest to smallest", () => {
    expect(elementCss(tree, DEFAULT_BREAKPOINTS)).toBe(
      '[data-nid="n1"]{color:red}[data-nid="n1"]:hover{color:blue}' +
        '@media (max-width:768px){[data-nid="n1"]{color:green}}' +
        '@media (max-width:414px){[data-nid="n1"]{color:pink}}'
    );
  });

  it("drops declarations that could break out of the rule", () => {
    expect(isSafeCssValue("red; } body { display:none")).toBe(false);
    expect(isSafeCssValue("calc(100% - 4px)")).toBe(true);
  });

  it("reports styles per breakpoint", () => {
    expect(hasStylesAt(tree, "tablet")).toBe(true);
    expect(hasStylesAt(tree, "nope")).toBe(false);
  });
});

describe("PageRenderer", () => {
  it("renders the walking skeleton tree to HTML with styles", () => {
    const root = emptyPageTree();
    root.children = [
      node({
        id: "s1",
        type: "section",
        htmlId: "nxtomc-abc12345",
        styles: { breakpoints: { base: { default: { padding: "24px" } } } },
        children: [
          node({ id: "h1", type: "heading", htmlTag: "h1", props: { text: "Hello" } }),
          node({ id: "b1", type: "button", props: { text: "Go", href: "/start" } }),
          node({ id: "i1", type: "image", props: { src: "javascript:x", alt: "pic" } })
        ]
      })
    ];
    const html = renderToStaticMarkup(
      <PageRenderer tree={root} breakpoints={DEFAULT_BREAKPOINTS} />
    );
    expect(html).toContain('<section data-nid="s1" id="nxtomc-abc12345">');
    expect(html).toContain('<h1 data-nid="h1">Hello</h1>');
    expect(html).toContain('<a data-nid="b1" href="/start">Go</a>');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("padding:24px");
  });

  it("skips unknown element types and unsafe attributes", () => {
    const root = emptyPageTree();
    root.children = [
      node({ id: "x", type: "mystery" }),
      node({
        id: "c",
        type: "container",
        attributes: { onclick: "boom()", "aria-label": "box" }
      })
    ];
    const html = renderToStaticMarkup(
      <PageRenderer tree={root} breakpoints={DEFAULT_BREAKPOINTS} />
    );
    expect(html).not.toContain("onclick");
    expect(html).toContain('aria-label="box"');
    expect(html).not.toContain("mystery");
  });
});
