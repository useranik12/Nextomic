import { describe, expect, it } from "vitest";
import { composePage, defaultNotFoundTree, MAIN_ID } from "./compose";
import { buildDynamicContext, createTokenResolver } from "./dynamic-context";
import { emptyPageTree } from "./page";
import { defaultPageSettings } from "./page";

const leaf = (id: string, text: string) => ({
  ...emptyPageTree(),
  id,
  type: "text",
  props: { text },
  children: []
});
const tree = (...children: ReturnType<typeof leaf>[]) => ({ ...emptyPageTree(), children });

describe("composePage", () => {
  it("returns the page untouched when there is no header or footer", () => {
    const page = tree(leaf("a", "x"));
    expect(composePage(page, null, null)).toBe(page);
  });

  it("puts the page in <main> between header and footer, with a skip link", () => {
    const out = composePage(
      tree(leaf("p", "body")),
      tree(leaf("h", "head")),
      tree(leaf("f", "foot"))
    );
    expect(out.children.map((c) => `${c.htmlTag ?? c.type}:${c.id}`)).toEqual([
      "a:layout-skip-link",
      "header:layout-header",
      "main:layout-main",
      "footer:layout-footer"
    ]);
    const main = out.children[2];
    expect(main?.htmlId).toBe(MAIN_ID);
    expect(main?.children.map((c) => c.id)).toEqual(["p"]);
    expect(out.children[0]?.props.href).toBe(`#${MAIN_ID}`);
  });

  it("adds only the parts that exist", () => {
    const out = composePage(tree(leaf("p", "b")), null, tree(leaf("f", "foot")));
    expect(out.children.map((c) => c.id)).toEqual(["layout-main", "layout-footer"]);
  });
});

describe("default 404", () => {
  it("is a main landmark with a heading", () => {
    const out = defaultNotFoundTree(emptyPageTree());
    expect(out.children[0]?.htmlTag).toBe("main");
    expect(out.children[0]?.children[0]?.htmlTag).toBe("h1");
  });
});

describe("page and template tags", () => {
  const ctx = buildDynamicContext({
    page: {
      name: "About",
      route: "/about",
      settings: defaultPageSettings(),
      meta: { id: "p1", status: "modified", categories: "News, Docs", tags: "x" }
    },
    template: {
      name: "Main header",
      type: "header",
      id: "t1",
      status: "published",
      createdBy: "Ana",
      createdAt: "",
      updatedAt: "",
      publishedAt: "",
      categories: "Layout",
      tags: ""
    },
    mode: "live"
  });
  const resolve = createTokenResolver(ctx);

  it("resolves status, marking and ids", () => {
    expect(resolve("page.status")).toBe("modified");
    expect(resolve("page.categories")).toBe("News, Docs");
    expect(resolve("page.name")).toBe("About");
    expect(resolve("template.status")).toBe("published");
    expect(resolve("template.type")).toBe("header");
    expect(resolve("template.categories")).toBe("Layout");
    expect(resolve("page.nope")).toBe("");
  });

  it("gives empty text for template tags on a page", () => {
    const plain = createTokenResolver(
      buildDynamicContext({
        page: { name: "A", route: "/a", settings: defaultPageSettings() },
        mode: "live"
      })
    );
    expect(plain("template.status")).toBe("");
    expect(plain("page.status")).toBe("");
  });
});
