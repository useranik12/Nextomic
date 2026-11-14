import {
  DEFAULT_BREAKPOINTS,
  buildDynamicContext,
  defaultPageSettings,
  emptyPageTree,
  newElementQuery,
  newTheme,
  type ElementNode
} from "@nextomic/schema";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PageRenderer,
  renderLoopCopies,
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
    expect(types).toEqual([
      "page",
      "section",
      "container",
      "heading",
      "text",
      "button",
      "image",
      "icon",
      "svg"
    ]);
  });

  it("marks every prop as bindable or opted out", () => {
    for (const def of listElementDefinitions()) {
      for (const key of Object.keys(def.propsSchema.shape)) {
        expect(def.bindable[key], `${def.type}.${key}`).toBeDefined();
      }
    }
  });

  it("resolves a dynamic token in every bindable prop", () => {
    const dynamic = buildDynamicContext({
      page: { name: "Shop", route: "/", settings: defaultPageSettings() },
      mode: "live"
    });
    // These must hold a valid length or SVG, so their own tests below check that tokens resolve.
    const checkedApart = new Set(["icon.size", "icon.svg", "svg.svg"]);
    const icons = {
      svg: (_library: string, name: string) =>
        `<svg viewBox="0 0 1 1"><title>${name}</title></svg>`,
      font: () => false
    };
    for (const def of listElementDefinitions()) {
      for (const [key, flag] of Object.entries(def.bindable)) {
        if (flag !== true || checkedApart.has(`${def.type}.${key}`)) continue;
        const root = emptyPageTree();
        const defaults = def.defaults();
        root.children = [
          node({
            id: "n",
            type: def.type,
            ...defaults,
            props: {
              ...defaults.props,
              ...(def.type === "icon" ? { library: "ph", name: "home" } : {}),
              [key]: { kind: "mixed", parts: ["x-", { token: "page.name" }] }
            }
          })
        ];
        const html = renderToStaticMarkup(
          <PageRenderer
            tree={root}
            breakpoints={DEFAULT_BREAKPOINTS}
            dynamic={dynamic}
            icons={icons}
          />
        );
        expect(html, `${def.type}.${key}`).toContain("x-Shop");
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

  it("gives an image from Media a srcset, and leaves other sources alone", () => {
    const render = (src: string) =>
      renderToStaticMarkup(
        <PageRenderer
          tree={{
            ...emptyPageTree(),
            children: [node({ id: "i1", type: "image", props: { src, alt: "pic" } })]
          }}
          breakpoints={DEFAULT_BREAKPOINTS}
        />
      );
    const id = "a1b2c3d4e5f60718293a4b5c";
    const stored = render(`/media/p1/${id}/hero.png`);
    expect(stored).toContain(`src="/media/p1/${id}/hero.png"`);
    expect(stored).toContain(`srcSet="/media/p1/${id}/hero.png?w=320 320w`);
    expect(render("https://example.com/a.png")).not.toContain("srcSet");
    expect(render(`/media/p1/${id}/logo.svg`)).not.toContain("srcSet");
  });

  it("renders a button as the chosen HTML tag, and a link when it has an address", () => {
    const render = (htmlTag: string | undefined, href: string) =>
      renderToStaticMarkup(
        <PageRenderer
          tree={{
            ...emptyPageTree(),
            children: [node({ id: "b", type: "button", htmlTag, props: { text: "Go", href } })]
          }}
          breakpoints={DEFAULT_BREAKPOINTS}
        />
      );
    expect(render("button", "")).toContain('<button data-nid="b" type="button">Go</button>');
    expect(render("button", "/x")).toContain('<a data-nid="b" href="/x">Go</a>');
    expect(render("div", "/x")).toContain('<div data-nid="b">Go</div>');
    expect(render("span", "")).toContain('<span data-nid="b">Go</span>');
    expect(render("a", "")).toContain('<a data-nid="b">Go</a>');
  });

  it("links the theme stylesheet when given and keeps the cascade order", () => {
    const theme = { ...newTheme("t", "Brand", []), variables: { bg: { light: "#fff" } } };
    const tree = {
      ...emptyPageTree(),
      children: [
        node({
          id: "h",
          type: "heading",
          styles: { breakpoints: { base: { default: { color: "red" } } } }
        })
      ]
    };
    const render = (themeStylesheet?: string) =>
      renderToStaticMarkup(
        <PageRenderer
          tree={tree}
          breakpoints={DEFAULT_BREAKPOINTS}
          variables={[{ name: "bg", type: "color", value: "#eee", group: "" } as never]}
          theme={theme}
          customCss=".mine{top:0}"
          {...(themeStylesheet ? { themeStylesheet } : {})}
        />
      );
    const inline = render();
    expect(inline).toContain('data-nxt-theme="brand"');
    expect(inline).not.toContain("<link");
    const linked = render("/theme-css/p/brand.css?v=1");
    expect(linked).toContain('<link rel="stylesheet" href="/theme-css/p/brand.css?v=1"/>');
    expect(linked).not.toContain('[data-nxt-theme="brand"]');
    // Variables before the link; custom CSS and element styles after it.
    const link = linked.indexOf("<link");
    expect(linked.indexOf("--nxt-bg:#eee")).toBeLessThan(link);
    expect(linked.indexOf(".mine{top:0}")).toBeGreaterThan(link);
    expect(linked.indexOf("color:red")).toBeGreaterThan(link);
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
        breakpoints: { base: { default: { width: "{{ page.name }}px", color: "{{ page.name }}" } } }
      }
    });
    expect(elementCss(el, DEFAULT_BREAKPOINTS)).toBe("");
    expect(elementCss(el, DEFAULT_BREAKPOINTS, () => "40")).toBe(
      '[data-nid="c"]{width:40px;color:40}'
    );
  });
});

describe("query loops", () => {
  const dynamic = buildDynamicContext({
    page: { name: "Blog", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });
  const loopTree = () => {
    const root = emptyPageTree();
    root.children = [
      node({
        id: "list",
        type: "container",
        query: { ...newElementQuery(), name: "posts" },
        children: [
          node({
            id: "t",
            type: "text",
            props: {
              text: {
                kind: "mixed",
                parts: [{ token: "%posts.item.title" }, " #", { token: "%posts.index" }]
              }
            }
          })
        ]
      })
    ];
    return root;
  };

  it("repeats the children once per row with %name.item and %name.index", () => {
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={loopTree()}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={dynamic}
        loopRows={{ list: { rows: [{ title: "A" }, { title: "B" }], hasMore: false } }}
      />
    );
    expect(html).toContain('<p data-nid="t">A #0</p><p data-nid="t">B #1</p>');
  });

  it("shows the fail fallback only when the query failed, not when it has no rows", () => {
    const tree = loopTree();
    const list = tree.children[0]!;
    list.query = {
      ...list.query!,
      fallback: { enabled: true, text: "Try again later" }
    };
    const render = (rows: { rows: unknown[]; hasMore: boolean; failed?: boolean }) =>
      renderToStaticMarkup(
        <PageRenderer
          tree={tree}
          breakpoints={DEFAULT_BREAKPOINTS}
          dynamic={dynamic}
          loopRows={{ list: rows }}
        />
      );
    expect(render({ rows: [], hasMore: false, failed: true })).toContain("Try again later");
    expect(render({ rows: [], hasMore: false })).not.toContain("Try again later");
    list.query = { ...list.query!, fallback: { enabled: false, text: "Try again later" } };
    expect(render({ rows: [], hasMore: false, failed: true })).not.toContain("Try again later");
  });

  it("renders no children without rows, or one placeholder copy on the canvas", () => {
    const none = renderToStaticMarkup(
      <PageRenderer tree={loopTree()} breakpoints={DEFAULT_BREAKPOINTS} dynamic={dynamic} />
    );
    expect(none).not.toContain('data-nid="t"');
    const placeholder = renderToStaticMarkup(
      <PageRenderer
        tree={loopTree()}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={dynamic}
        loopPlaceholder
      />
    );
    expect(placeholder).toContain('<p data-nid="t"> #0</p>');
  });

  it("reaches outer rows by loop name in nested loops", () => {
    const root = loopTree();
    const outer = root.children[0]!;
    const inner = node({
      id: "inner",
      type: "container",
      query: { ...newElementQuery(), name: "tags" },
      children: [
        node({
          id: "c",
          type: "text",
          props: {
            text: {
              kind: "mixed",
              parts: [{ token: "%posts.item.title" }, "/", { token: "%tags.item" }]
            }
          }
        })
      ]
    });
    outer.children = [inner];
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={root}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={dynamic}
        loopRows={{
          list: { rows: [{ title: "A" }], hasMore: false },
          "list#0/inner": { rows: ["x", "y"], hasMore: false }
        }}
      />
    );
    expect(html).toContain('<p data-nid="c">A/x</p><p data-nid="c">A/y</p>');
  });

  it("marks loops and rows for the client runtime on built pages", () => {
    const tree = loopTree();
    const list = tree.children[0]!;
    if (list.query)
      list.query.supabase = {
        ...list.query.supabase,
        infiniteScroll: true,
        realtime: true,
        table: "posts"
      };
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={tree}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={dynamic}
        loopMarkers
        loopRows={{ list: { rows: [{ title: "A" }], hasMore: true } }}
      />
    );
    expect(html).toContain(
      'data-nx-loop="list" data-nx-count="1" data-nx-more="1" data-nx-scroll="" data-nx-realtime="public.posts"'
    );
    expect(html).toContain('<p data-nid="t" data-nx-row="0">A #0</p>');
  });

  it("renders a later page of copies on their own with their real positions", () => {
    const rows: unknown[] = [];
    rows[2] = { title: "C" };
    const list = loopTree().children[0]!;
    const html = renderToStaticMarkup(
      <>
        {renderLoopCopies(
          list,
          {
            breakpoints: DEFAULT_BREAKPOINTS,
            dynamic,
            loopMarkers: true,
            loopRows: { list: { rows, hasMore: false } }
          },
          { path: [], frames: [] }
        )}
      </>
    );
    expect(html).toBe('<p data-nid="t" data-nx-row="2">C #2</p>');
  });
});

describe("conditional visibility", () => {
  const dynamic = buildDynamicContext({
    page: { name: "Shop", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });
  const when = (left: string, op: string, right = "") => ({
    enabled: true,
    group: {
      id: "g",
      match: "all" as const,
      items: [{ id: "c", kind: "value" as const, left, op: op as "equals", right }]
    }
  });
  const tree = () => {
    const root = emptyPageTree();
    root.children = [
      node({
        id: "yes",
        type: "text",
        props: { text: "Shown" },
        visibility: when("{{ page.name }}", "equals", "shop")
      }),
      node({
        id: "no",
        type: "text",
        props: { text: "Secret" },
        visibility: when("{{ page.name }}", "equals", "Blog")
      }),
      node({
        id: "list",
        type: "container",
        query: { ...newElementQuery(), name: "posts" },
        children: [
          node({
            id: "row",
            type: "text",
            props: { text: { kind: "mixed", parts: [{ token: "%posts.item.t" }] } },
            visibility: when("{{ %posts.item.n }}", "greaterThan", "1")
          })
        ]
      })
    ];
    return root;
  };

  it("leaves failing elements out of the HTML, per loop row too", () => {
    const failed = new Set<string>();
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={tree()}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={dynamic}
        conditionsFailed={failed}
        loopRows={{
          list: {
            rows: [
              { t: "A", n: 1 },
              { t: "B", n: 2 }
            ],
            hasMore: false
          }
        }}
      />
    );
    expect(html).toContain("Shown");
    expect(html).not.toContain("Secret");
    expect(html).not.toContain(">A<");
    expect(html).toContain(">B<");
    expect([...failed].sort()).toEqual(["no", "row"]);
  });

  it("follows the editor's Show / Hide preview switch", () => {
    const html = renderToStaticMarkup(
      <PageRenderer
        tree={tree()}
        breakpoints={DEFAULT_BREAKPOINTS}
        dynamic={dynamic}
        visibilityPreview={{ no: "show", yes: "hide" }}
      />
    );
    expect(html).toContain("Secret");
    expect(html).not.toContain("Shown");
  });

  it("checks the class, ID and attributes of this or another element", () => {
    const has = (
      kind: "class" | "id" | "attribute",
      left: string,
      target?: string,
      right = ""
    ) => ({
      enabled: true,
      group: {
        id: "g",
        match: "all" as const,
        items: [{ id: "c", kind, target, left, op: "has" as const, right }]
      }
    });
    const root = emptyPageTree();
    root.children = [
      node({
        id: "btn",
        type: "button",
        props: { text: "Toggle", href: "" },
        classIds: ["is-active"],
        attributes: { "aria-expanded": "true" }
      }),
      node({
        id: "p1",
        type: "text",
        props: { text: "PanelOne" },
        visibility: has("class", "is-active", "btn")
      }),
      node({
        id: "p2",
        type: "text",
        props: { text: "PanelTwo" },
        visibility: has("class", "open", "btn")
      }),
      node({
        id: "p3",
        type: "text",
        props: { text: "PanelThree" },
        visibility: has("attribute", "aria-expanded", "btn", "true")
      }),
      node({
        id: "p4",
        type: "text",
        htmlId: "nxtomc-self0001",
        props: { text: "PanelFour" },
        visibility: has("id", "nxtomc-self0001")
      }),
      node({
        id: "p5",
        type: "text",
        props: { text: "PanelFive" },
        visibility: has("class", "x", "gone")
      })
    ];
    const html = renderToStaticMarkup(
      <PageRenderer tree={root} breakpoints={DEFAULT_BREAKPOINTS} dynamic={dynamic} />
    );
    expect(html).toContain("PanelOne");
    expect(html).not.toContain("PanelTwo");
    expect(html).toContain("PanelThree");
    expect(html).toContain("PanelFour");
    expect(html).not.toContain("PanelFive");
  });

  describe("icon and svg", () => {
    const render = (el: ElementNode, extra: object = {}) =>
      renderToStaticMarkup(
        <PageRenderer
          tree={{ ...emptyPageTree(), children: [el] }}
          breakpoints={DEFAULT_BREAKPOINTS}
          {...extra}
        />
      );
    const lookup = {
      svg: (library: string, name: string, o: { size: string; label: string }) =>
        library === "ph" && name === "home"
          ? `<svg viewBox="0 0 24 24" height="${o.size}"><path d="M0 0"/></svg>`
          : null,
      font: (library: string, name: string) => library === "brand" && name === "star"
    };
    const icon = (props: Record<string, unknown>) =>
      node({
        id: "i1",
        type: "icon",
        props: { ...getElementDefinition("icon")!.defaults().props, ...props } as never
      });

    it("draws a library icon inline, decorative unless it has a name", () => {
      const html = render(icon({ library: "ph", name: "home", size: "2em" }), { icons: lookup });
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('height="2em"');
      expect(
        render(icon({ library: "ph", name: "home", label: "Home" }), { icons: lookup })
      ).toContain('role="img" aria-label="Home"');
    });
    it("draws an icon-font glyph as a class, and renders an empty box for an unknown icon", () => {
      const font = render(icon({ library: "brand", name: "star" }), { icons: lookup });
      expect(font).toContain("<i");
      expect(font).toContain("nxt-brand-star");
      const missing = render(icon({ library: "ph", name: "nope" }), { icons: lookup });
      expect(missing).toContain("<span");
      expect(missing).not.toContain("<svg");
      expect(render(icon({}), { icons: lookup })).not.toContain("<svg");
      expect(render(icon({ library: "ph", name: "home" }))).not.toContain("<svg");
    });
    it("writes the icon-font CSS it was given with the fonts", () => {
      const html = render(icon({ library: "brand", name: "star" }), {
        icons: lookup,
        iconCss: ".nxt-brand-star::before{content:'x'}"
      });
      expect(html).toContain(".nxt-brand-star::before");
    });
    it("builds an icon from SVG code, recolored unless colors are kept, and strips scripts", () => {
      const svg =
        '<svg viewBox="0 0 8 8"><script>alert(1)</script><path fill="#f00" onclick="x()" d="M0 0h8v8z"/></svg>';
      const plain = render(icon({ source: "svg", svg }));
      expect(plain).toContain("currentColor");
      expect(plain).not.toMatch(/alert|onclick|#f00/);
      expect(render(icon({ source: "svg", svg, keepColors: true }))).toContain("#f00");
      expect(render(icon({ source: "svg", svg: "not svg" }))).not.toContain("<svg");
    });
    it("resolves tokens in the size and the SVG code", () => {
      const dynamic = buildDynamicContext({
        page: { name: "Shop", route: "/", settings: defaultPageSettings() },
        mode: "live"
      });
      const html = render(
        icon({ source: "svg", svg: '<svg viewBox="0 0 8 8"><path d="M0 0"/></svg>', size: "3px" }),
        { dynamic }
      );
      expect(html).toContain('height="3px"');
      const inline = render(
        node({
          id: "s1",
          type: "svg",
          props: {
            svg: {
              kind: "mixed",
              parts: ['<svg viewBox="0 0 8 8"><title>', { token: "page.name" }, "</title></svg>"]
            }
          } as never
        }),
        { dynamic }
      );
      expect(inline).toContain("Shop");
    });
    it("renders an SVG element sanitized, empty when it has none", () => {
      const svg = (code: string) =>
        render(node({ id: "s1", type: "svg", props: { svg: code, label: "" } }));
      expect(svg('<svg viewBox="0 0 8 8"><script>x</script><path d="M0 0"/></svg>')).not.toContain(
        "script"
      );
      expect(svg("")).not.toContain("<svg");
    });
  });
});
