import { describe, expect, it } from "vitest";
import { elementNodeSchema, type ElementNode } from "./element";
import {
  loopNames,
  pageTreeSchema,
  renameLoopTag,
  uniqueLoopNames,
  upgradeLoopExpression,
  upgradeLoopTree
} from "./loop-names";
import { loopNameProblem, newElementQuery } from "./query";

const node = (id: string, patch: Record<string, unknown> = {}, children: unknown[] = []) =>
  elementNodeSchema.parse({ id, type: "container", children, ...patch });
const text = (id: string, value: string) =>
  elementNodeSchema.parse({ id, type: "text", props: { text: value } });
const loop = (name: string, source = "supabase") => ({ query: { enabled: true, source, name } });
const textOf = (n: ElementNode | undefined) => n?.props.text;

describe("loop names", () => {
  it("validates names", () => {
    expect(loopNameProblem("")).toBe("Give the loop a name.");
    expect(loopNameProblem("1posts")).toMatch(/letters/);
    expect(loopNameProblem("my-loop")).toMatch(/letters/);
    expect(loopNameProblem("posts", ["posts"])).toMatch(/Another loop/);
    expect(loopNameProblem("posts_2")).toBeNull();
  });

  it("names a new query after its source, numbered when taken", () => {
    expect(newElementQuery().name).toBe("supabaseLoop");
    expect(newElementQuery(["supabaseLoop"]).name).toBe("supabaseLoop2");
  });

  it("lists names except one element's", () => {
    const tree = node("root", {}, [node("a", loop("posts")), node("b", loop("tags"))]);
    expect(loopNames(tree)).toEqual(["posts", "tags"]);
    expect(loopNames(tree, "a")).toEqual(["tags"]);
  });

  it("renames %name tags only, keeping modulo and other loops", () => {
    const value = {
      text: "{{ %posts.item.title }} - {{ n %posts }} - {{ %postsX.index }} - %posts",
      token: "%posts.index + 1"
    };
    const { value: out, changed } = renameLoopTag(value, "posts", "articles");
    expect(changed).toBe(true);
    expect(out.text).toBe(
      "{{ %articles.item.title }} - {{ n %posts }} - {{ %postsX.index }} - %posts"
    );
    expect(out.token).toBe("%articles.index + 1");
  });
});

describe("upgrading old loop tags", () => {
  it("rewrites item, index and parent chains by depth", () => {
    const names = ["comments", "posts"];
    expect(upgradeLoopExpression(" item.title ", names)).toBe(" %comments.item.title ");
    expect(upgradeLoopExpression("index + 1", names)).toBe("%comments.index + 1");
    expect(upgradeLoopExpression("parent.item.title", names)).toBe("%posts.item.title");
    expect(upgradeLoopExpression("parent.index", names)).toBe("%posts.index");
  });

  it("leaves fields, arrow params, quoted text and missing outer loops alone", () => {
    const names = ["posts"];
    expect(upgradeLoopExpression("page.item", names)).toBe("page.item");
    expect(upgradeLoopExpression("item.tags.map(item => item.name)", names)).toBe(
      "item.tags.map(item => item.name)"
    );
    expect(upgradeLoopExpression("item.tags.map(t => t + item.id)", names)).toBe(
      "%posts.item.tags.map(t => t + %posts.item.id)"
    );
    expect(upgradeLoopExpression('"item" + item.a', names)).toBe('"item" + %posts.item.a');
    expect(upgradeLoopExpression("parent.item.a", names)).toBe("parent.item.a");
    expect(upgradeLoopExpression("item.a", [])).toBe("item.a");
  });

  it("names old loops and rewrites only their descendants' tags", () => {
    const old = node("root", {}, [
      text("outside", "{{ item.title }}"),
      node("posts", { query: { enabled: true, source: "supabase" } }, [
        text("t1", "{{ item.title }}"),
        node(
          "comments",
          {
            query: {
              enabled: true,
              source: "rest",
              rest: { values: { post: "{{ item.id }}" } }
            }
          },
          [text("t2", "{{ item.body }} on {{ parent.item.title }} #{{ index }}")]
        )
      ])
    ]);
    const tree = upgradeLoopTree(old);
    const posts = tree.children[1];
    const comments = posts?.children[1];
    expect(posts?.query?.name).toBe("supabaseLoop");
    expect(comments?.query?.name).toBe("restLoop");
    expect(textOf(tree.children[0])).toBe("{{ item.title }}");
    expect(textOf(posts?.children[0])).toBe("{{ %supabaseLoop.item.title }}");
    // A loop's own settings read the loops around it, not itself.
    expect(comments?.query?.rest.values.post).toBe("{{ %supabaseLoop.item.id }}");
    expect(textOf(comments?.children[0])).toBe(
      "{{ %restLoop.item.body }} on {{ %supabaseLoop.item.title }} #{{ %restLoop.index }}"
    );
  });

  it("runs once: named trees are returned as they are", () => {
    const tree = node("root", {}, [node("a", loop("posts"), [text("t", "{{ item.x }}")])]);
    expect(upgradeLoopTree(tree)).toBe(tree);
  });

  it("upgrades when a stored tree is read", () => {
    const stored = {
      id: "root",
      type: "section",
      query: { enabled: true },
      children: [{ id: "t", type: "text", props: { text: "{{ item.name }}" } }]
    };
    const tree = pageTreeSchema.parse(stored);
    expect(tree.query?.name).toBe("supabaseLoop");
    expect(textOf(tree.children[0])).toBe("{{ %supabaseLoop.item.name }}");
  });
});

describe("unique loop names", () => {
  it("renames a duplicated loop and its own tags", () => {
    const copy = () => node("x", loop("posts"), [text("t", "{{ %posts.item.title }}")]);
    const tree = node("root", {}, [copy(), { ...copy(), id: "y" }]);
    const fixed = uniqueLoopNames(tree);
    expect(loopNames(fixed)).toEqual(["posts", "posts2"]);
    expect(textOf(fixed.children[0]?.children[0])).toBe("{{ %posts.item.title }}");
    expect(textOf(fixed.children[1]?.children[0])).toBe("{{ %posts2.item.title }}");
  });

  it("returns the same tree when names are unique", () => {
    const tree = node("root", {}, [node("a", loop("a")), node("b", loop("b"))]);
    expect(uniqueLoopNames(tree)).toBe(tree);
  });
});
