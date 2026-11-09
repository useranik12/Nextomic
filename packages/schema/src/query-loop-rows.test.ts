import { describe, expect, it } from "vitest";
import type { ElementNode } from "./element";
import { newElementQuery } from "./query";
import { collectLoopRows, loopInstances, loopKey, parseLoopKey } from "./query-loop-rows";

const node = (
  id: string,
  type: string,
  children: ElementNode[] = [],
  query = false
): ElementNode => ({
  id,
  type,
  classIds: [],
  props: {},
  styles: { breakpoints: {} },
  actions: {},
  children,
  ...(query ? { query: { ...newElementQuery(), name: id } } : {})
});

// A list of posts, each with a nested comments loop.
const tree = node("root", "page", [
  node("posts", "container", [node("comments", "container", [node("t", "text")], true)], true)
]);

describe("loop instances", () => {
  it("keys a run by the outer loop rows and its id", () => {
    expect(loopKey([], "posts")).toBe("posts");
    expect(loopKey([{ id: "posts", index: 2 }], "comments")).toBe("posts#2/comments");
  });

  it("lists inner loops only once the outer loop has rows", () => {
    expect(loopInstances(tree, {}).map((i) => i.key)).toEqual(["posts"]);
    const rows = { posts: { rows: [{ id: 1 }, { id: 2 }], hasMore: false } };
    const all = loopInstances(tree, rows);
    expect(all.map((i) => i.key)).toEqual(["posts", "posts#0/comments", "posts#1/comments"]);
    expect(all[2]?.frames).toEqual([{ name: "posts", item: { id: 2 }, index: 1 }]);
    expect(loopInstances(tree, rows, 2)).toHaveLength(2);
  });

  it("skips hidden elements and turned-off queries", () => {
    const off = node("x", "container", [], true);
    if (off.query) off.query.enabled = false;
    const hidden = { ...node("h", "container", [], true), hidden: true };
    expect(loopInstances(node("root", "page", [off, hidden]), {})).toEqual([]);
  });
});

describe("collectLoopRows", () => {
  it("runs outer loops first and fills inner templates with the outer row", async () => {
    const seen: string[] = [];
    const rows = await collectLoopRows(tree, { page: { name: "Blog" } }, async (instance, fill) => {
      seen.push(`${instance.key}:${fill("{{page.name}}-{{%posts.item.id}}")}`);
      return instance.node.id === "posts"
        ? { rows: [{ id: 7 }, { id: 8 }], hasMore: false }
        : { rows: ["c"], hasMore: false };
    });
    expect(seen).toEqual(["posts:Blog-", "posts#0/comments:Blog-7", "posts#1/comments:Blog-8"]);
    expect(Object.keys(rows)).toHaveLength(3);
  });

  it("gives a failing loop no rows and stops at the run limit", async () => {
    const failed = await collectLoopRows(tree, {}, () => Promise.reject(new Error("down")));
    expect(failed).toEqual({ posts: { rows: [], hasMore: false } });
    let runs = 0;
    await collectLoopRows(
      tree,
      {},
      async () => {
        runs += 1;
        return { rows: [1, 2, 3], hasMore: false };
      },
      2
    );
    expect(runs).toBe(2);
  });
});

describe("loop keys from the browser", () => {
  it("parses well-formed keys and rejects anything else", () => {
    expect(parseLoopKey("posts#2/comments")).toEqual({
      path: [{ id: "posts", index: 2 }],
      id: "comments"
    });
    expect(parseLoopKey("posts")).toEqual({ path: [], id: "posts" });
    for (const bad of ["", "a#x/b", "a/b#1", "a b", "posts#-1/c", `${"a#1/".repeat(25)}b`])
      expect(parseLoopKey(bad)).toBeNull();
  });
});

describe("a later page of a loop", () => {
  it("starts inside the outer loops and runs nested loops only for the new rows", async () => {
    const posts = tree.children[0];
    if (!posts) throw new Error("tree");
    const page: unknown[] = [];
    page[5] = { id: 6 };
    const seen: string[] = [];
    const rows = await collectLoopRows(
      posts,
      {},
      async (instance, fill) => {
        seen.push(`${instance.key}:${fill("{{%posts.item.id}}")}`);
        return { rows: [], hasMore: false };
      },
      200,
      { path: [], frames: [] },
      { posts: { rows: page, hasMore: true } }
    );
    expect(seen).toEqual(["posts#5/comments:6"]);
    expect(rows.posts?.hasMore).toBe(true);
  });
});
