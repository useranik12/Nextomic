import { describe, expect, it } from "vitest";
import {
  accountStatusEnum,
  colorModeEnum,
  connectorOperationEnum,
  connectorTypeEnum,
  genderEnum,
  mediaKindEnum,
  pages,
  pageVersions,
  platformRoleEnum,
  projectRoleEnum,
  projects,
  templateTypeEnum,
  userMeta,
  userPreferences,
  users,
  workspaceMembers,
  workspaceRoleEnum,
  workspaces
} from "./schema";

describe("db schema", () => {
  it("defines the workspace and project roles", () => {
    expect(workspaceRoleEnum.enumValues).toEqual(["owner", "editor", "member", "viewer"]);
    expect(projectRoleEnum.enumValues).toEqual([
      "owner",
      "editor",
      "designer",
      "content_editor",
      "viewer"
    ]);
  });

  it("defines the account enums", () => {
    expect(platformRoleEnum.enumValues).toEqual([
      "Admin",
      "Developer",
      "Senior Marketer",
      "Junior Marketer",
      "Affiliate Scout",
      "Customer"
    ]);
    expect(accountStatusEnum.enumValues).toEqual(["Good", "Warning", "Suspended"]);
    expect(genderEnum.enumValues).toEqual(["Male", "Female", "Prefer Not To Say"]);
  });

  it("defines the builder enums", () => {
    expect(colorModeEnum.enumValues).toEqual(["dark", "light", "system"]);
    expect(connectorTypeEnum.enumValues).toEqual(["supabase", "rest"]);
    expect(connectorOperationEnum.enumValues).toEqual(["test", "resources", "execute"]);
    expect(templateTypeEnum.enumValues).toEqual([
      "header",
      "footer",
      "error",
      "modal",
      "bottom-sheet",
      "section"
    ]);
    expect(mediaKindEnum.enumValues).toContain("image");
    expect(mediaKindEnum.enumValues).toContain("other");
  });

  it("exports the platform tables", () => {
    for (const table of [
      users,
      userMeta,
      workspaces,
      workspaceMembers,
      projects,
      userPreferences,
      pages,
      pageVersions
    ]) {
      expect(table).toBeDefined();
    }
  });
});
