import {
  buildDynamicContext,
  defaultPageSettings,
  elementNodeSchema,
  projectSettingsSchema,
  type DynamicContext,
  type ElementNode
} from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { renderParts, withClientState, withResults } from "./fragments";

const settings = projectSettingsSchema.parse({});

function context(): DynamicContext {
  const dynamic = buildDynamicContext({
    page: { name: "Home", route: "/", settings: defaultPageSettings() },
    mode: "live"
  });
  return { ...dynamic, state: { open: "false" }, app: { theme: "light" } };
}

const node = (raw: Record<string, unknown>): ElementNode => elementNodeSchema.parse(raw);

const panel = node({
  id: "panel",
  type: "text",
  props: { text: "Panel body" },
  visibility: {
    group: {
      id: "g",
      match: "all",
      items: [{ id: "c", kind: "value", left: "{{ state.open }}", op: "equals", right: "true" }]
    }
  }
});
const tree = node({ id: "root", type: "section", children: [panel] });

describe("withClientState", () => {
  it("replaces only declared values", () => {
    const next = withClientState(context(), { theme: "dark", extra: "x" }, { open: "true" });
    expect(next.app).toEqual({ theme: "dark" });
    expect(next.state).toEqual({ open: "true" });
  });
});

describe("withResults", () => {
  it("takes only declared names of bounded size and reads them as values", async () => {
    const declared = new Set(["posts"]);
    const next = withResults(
      context(),
      { posts: '[{"title":"A"}]', other: "x", big: "y".repeat(100_001) },
      declared
    );
    expect(next.results).toEqual({ posts: '[{"title":"A"}]' });
    const huge = withResults(context(), { posts: "y".repeat(100_001) }, declared);
    expect(huge.results).toEqual({});
    const again = withResults(context(), {}, declared, { posts: "y".repeat(150_000), other: "z" });
    expect(Object.keys(again.results)).toEqual(["posts"]);
    const title = node({
      id: "t",
      type: "text",
      props: { text: { kind: "mixed", parts: [{ token: "results.posts?.[0]?.title" }] } }
    });
    const root = node({ id: "root", type: "section", children: [title] });
    const parts = await renderParts({ tree: root, dynamic: next, settings, ids: ["t"] });
    expect(parts[0]?.html).toContain(">A<");
  });
});

describe("renderParts", () => {
  it("renders an empty slot while the condition fails and the element once it holds", async () => {
    const closed = await renderParts({ tree, dynamic: context(), settings, ids: ["panel"] });
    expect(closed[0]?.html).toBe('<template data-nx-slot="panel"></template>');
    expect(closed[0]?.html).not.toContain("Panel body");

    const dynamic = withClientState(context(), {}, { open: "true" });
    const open = await renderParts({ tree, dynamic, settings, ids: ["panel"] });
    expect(open[0]?.html).toContain("Panel body");
    expect(open[0]?.html).toContain('data-nid="panel"');
  });

  it("skips unknown ids", async () => {
    expect(await renderParts({ tree, dynamic: context(), settings, ids: ["nope"] })).toEqual([]);
  });

  it("applies class edits so a class condition on another element holds, and runs loops", async () => {
    const gated = node({
      id: "gated",
      type: "text",
      props: { text: "Menu is open" },
      visibility: {
        group: {
          id: "g",
          match: "all",
          items: [{ id: "c", kind: "class", target: "menu", op: "has", left: "is-open" }]
        }
      }
    });
    const menu = node({ id: "menu", type: "container", classIds: ["menu"] });
    const page = node({ id: "root", type: "section", children: [menu, gated] });
    const closed = await renderParts({ tree: page, dynamic: context(), settings, ids: ["gated"] });
    expect(closed[0]?.html).toBe('<template data-nx-slot="gated"></template>');
    const open = await renderParts({
      tree: page,
      dynamic: context(),
      settings,
      ids: ["gated", "menu"],
      edits: { menu: { addClasses: ["is-open"], removeClasses: [] } }
    });
    expect(open[0]?.html).toContain("Menu is open");
    expect(open[1]?.html).toContain("is-open");
  });
});
