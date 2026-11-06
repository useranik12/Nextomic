import {
  DEFAULT_BREAKPOINTS,
  buildDynamicContext,
  defaultPageSettings,
  emptyPageTree,
  newTheme,
  type ElementNode
} from "@nextomic/schema";
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

describe("themes", () => {
  const theme = {
    ...newTheme("t", "Brand", []),
    darkMode: true,
    variables: { bg: { dark: "#000" } }
  };

  it("emits theme variables and the boot script only when asked", () => {
    const tree = emptyPageTree();
    const css = renderToStaticMarkup(
      <PageRenderer tree={tree} breakpoints={DEFAULT_BREAKPOINTS} theme={theme} />
    );
    expect(css).toContain('[data-nxt-theme="brand"][data-nxt-mode="dark"]{--nxt-bg:#000}');
    expect(css).not.toContain("<script");
    const built = renderToStaticMarkup(
      <PageRenderer tree={tree} breakpoints={DEFAULT_BREAKPOINTS} theme={theme} bootScript />
    );
    expect(built).toContain("<script");
  });

  it("prunes unused framework classes only when asked, and keeps safelisted ones", () => {
    const themed = {
      ...newTheme("t", "Brand", []),
      framework: {
        name: "Imported",
        source: "import" as const,
        variables: [],
        css: ".used{color:red}.unused{color:blue}.later{color:green}",
        scales: [],
        colorOptions: {},
        version: 1
      }
    } as unknown as typeof theme;
    const tree = emptyPageTree();
    tree.classIds = ["used"];
    const html = (props: { pruneUnusedClasses?: boolean; keepClasses?: string[] }) =>
      renderToStaticMarkup(
        <PageRenderer tree={tree} breakpoints={DEFAULT_BREAKPOINTS} theme={themed} {...props} />
      );
    expect(html({})).toContain(".unused");
    const pruned = html({ pruneUnusedClasses: true, keepClasses: ["later"] });
    expect(pruned).toContain(".used");
    expect(pruned).toContain(".later");
    expect(pruned).not.toContain(".unused");
  });
});

describe("fonts in output", () => {
  const font = {
    id: "acme",
    family: "Acme",
    source: "upload" as const,
    sourceNote: "",
    category: "sans-serif" as const,
    license: "",
    active: true,
    favorite: false,
    rights: true,
    preload: true,
    display: "swap" as const,
    files: [
      {
        file: "400-normal.woff2",
        format: "woff2" as const,
        weight: 400,
        style: "normal" as const,
        subset: "latin",
        bytes: 10,
        sha256: "a".repeat(64)
      }
    ]
  };
  const tree = emptyPageTree();

  it("writes @font-face from the project's own origin and a preload link on built pages", () => {
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={tree}
        breakpoints={DEFAULT_BREAKPOINTS}
        fonts={[font]}
        fontBase="/fonts/p1"
        bootScript
      />
    );
    expect(html).toContain(
      "src:url(&quot;/fonts/p1/acme/400-normal.woff2&quot;)".replace(/&quot;/g, '"')
    );
    expect(html).toContain('rel="preload"');
    expect(html).not.toContain("googleapis");
    expect(html).not.toContain("gstatic");
  });

  it("writes nothing for inactive fonts and no preload on the editor canvas", () => {
    const off = renderToStaticMarkup(
      <PageRenderer
        tree={tree}
        breakpoints={DEFAULT_BREAKPOINTS}
        fonts={[{ ...font, active: false }]}
        fontBase="/fonts/p1"
        bootScript
      />
    );
    expect(off).not.toContain("@font-face");
    const canvas = renderToStaticMarkup(
      <PageRenderer
        tree={tree}
        breakpoints={DEFAULT_BREAKPOINTS}
        fonts={[font]}
        fontBase="/fonts/p1"
      />
    );
    expect(canvas).toContain("@font-face");
    expect(canvas).not.toContain("preload");
  });
});

describe("dynamic tags", () => {
  it("shows what the dynamic context resolves to, and nothing for unknown tags", () => {
    const heading = node({
      id: "h",
      type: "heading",
      props: {
        text: { kind: "mixed", parts: ["Hi ", { token: "page.name" }, " / ", { token: "nope.x" }] }
      }
    });
    const tree = { ...emptyPageTree(), children: [heading] };
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={tree}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={buildDynamicContext({
          page: { name: "About us", route: "/about", settings: defaultPageSettings() },
          mode: "preview"
        })}
      />
    );
    expect(html).toContain("Hi About us / ");
    expect(html).not.toContain("{{");
  });
});

describe("element attributes and element tokens", () => {
  it("adds attributes that read another element's value by ID, and drops URL attributes that are unsafe", () => {
    const source = node({
      id: "src",
      type: "container",
      htmlId: "nxtomc-source01",
      attributes: { "data-label": "Hello" }
    });
    const target = node({
      id: "dst",
      type: "container",
      attributes: {
        "aria-label": { kind: "mixed", parts: [{ token: "attr @ nxtomc-source01:data-label" }] },
        href: "javascript:alert(1)",
        required: ""
      }
    });
    const tree = { ...emptyPageTree(), children: [source, target] };
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={tree}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={buildDynamicContext({
          page: { name: "P", route: "/", settings: defaultPageSettings() },
          tree,
          mode: "preview"
        })}
      />
    );
    expect(html).toContain('aria-label="Hello"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain('required=""');
  });
});

describe("dynamic style values", () => {
  it("fills tokens in style values and drops them without a resolver", () => {
    const el = node({
      id: "c",
      type: "container",
      styles: {
        breakpoints: { base: { default: { width: "{{page.name}}px", color: "{{page.name}}" } } }
      }
    });
    expect(elementCss(el, DEFAULT_BREAKPOINTS)).toBe("");
    expect(elementCss(el, DEFAULT_BREAKPOINTS, () => "40")).toBe(
      '[data-nid="c"]{width:40px;color:40}'
    );
  });
});
