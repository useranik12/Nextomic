import {
  buildDynamicContext,
  defaultPageSettings,
  elementNodeSchema,
  projectSettingsSchema,
  type DynamicContext,
  type ElementNode
} from "@nextomic/schema";
import { describe, expect, it } from "vitest";
import { renderParts, withClientState } from "./fragments";

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

describe("renderParts", () => {
  it("renders an empty slot while the condition fails and the element once it holds", () => {
    const closed = renderParts({ tree, dynamic: context(), settings, ids: ["panel"] });
    expect(closed[0]?.html).toBe('<template data-nx-slot="panel"></template>');
    expect(closed[0]?.html).not.toContain("Panel body");

    const dynamic = withClientState(context(), {}, { open: "true" });
    const open = renderParts({ tree, dynamic, settings, ids: ["panel"] });
    expect(open[0]?.html).toContain("Panel body");
    expect(open[0]?.html).toContain('data-nid="panel"');
  });

  it("skips unknown ids", () => {
    expect(renderParts({ tree, dynamic: context(), settings, ids: ["nope"] })).toEqual([]);
  });
});
