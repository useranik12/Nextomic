import { describe, expect, it } from "vitest";
import { actionGroups } from "./action-groups";

const lookup = {
  columns: (ref: string) =>
    ref === "public.posts"
      ? [
          { name: "id", type: "int" },
          { name: "title", type: "text" }
        ]
      : null,
  restFields: () => null
};

describe("actionGroups", () => {
  it("offers the columns of a Supabase response, as a list", () => {
    const [group] = actionGroups(
      [{ name: "rows", kind: "output", type: "supabase.query", params: { table: "public.posts" } }],
      lookup
    );
    expect(group?.tags.map((t) => t.token)).toEqual([
      "rows",
      "rows[0]",
      "rows[0].id",
      "rows[0].title"
    ]);
  });

  it("reads a single-row query and a sign-in user by field", () => {
    const [one, user] = actionGroups(
      [
        {
          name: "post",
          kind: "output",
          type: "supabase.query",
          params: { table: "public.posts", single: "true" }
        },
        { name: "me", kind: "output", type: "auth.login", params: {} }
      ],
      lookup
    );
    expect(one?.tags.map((t) => t.token)).toContain("post.title");
    expect(user?.tags.map((t) => t.token)).toContain("me.email");
  });

  it("offers only the whole response when the shape is unknown", () => {
    const [group] = actionGroups(
      [{ name: "x", kind: "output", type: "supabase.rpc", params: {} }],
      lookup
    );
    expect(group?.tags.map((t) => t.token)).toEqual(["x"]);
  });
});
