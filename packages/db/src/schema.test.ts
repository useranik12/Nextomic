import { describe, expect, it } from "vitest";
import {
  colorModeEnum,
  projects,
  userPreferences,
  workspaceMembers,
  workspaceRoleEnum,
  workspaces
} from "./schema";

describe("db schema", () => {
  it("defines the expected workspace roles", () => {
    expect(workspaceRoleEnum.enumValues).toEqual(["owner", "admin", "member"]);
  });

  it("defines the expected color modes", () => {
    expect(colorModeEnum.enumValues).toEqual(["dark", "light", "system"]);
  });

  it("exports the platform tables", () => {
    expect(workspaces).toBeDefined();
    expect(workspaceMembers).toBeDefined();
    expect(projects).toBeDefined();
    expect(userPreferences).toBeDefined();
  });
});
