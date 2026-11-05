import { describe, expect, it } from "vitest";
import { colorModeSchema, createProjectInputSchema, workspaceRoleSchema } from "./index";

describe("schema package", () => {
  it("accepts valid workspace roles", () => {
    expect(workspaceRoleSchema.parse("owner")).toBe("owner");
    expect(() => workspaceRoleSchema.parse("superadmin")).toThrow();
  });

  it("validates create-project input", () => {
    expect(createProjectInputSchema.parse({ name: "My Fresh Site" })).toEqual({
      name: "My Fresh Site"
    });
    expect(() => createProjectInputSchema.parse({ name: "" })).toThrow();
  });

  it("defaults color mode to dark", () => {
    expect(colorModeSchema.parse("dark")).toBe("dark");
  });
});
