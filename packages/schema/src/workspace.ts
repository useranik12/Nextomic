import { z } from "zod";

// Workspace roles are platform-level (see docs/platform.md section 2).
// Project-level roles (owner/editor/designer/content editor/viewer) are a later phase.
export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceMemberSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  role: workspaceRoleSchema,
  createdAt: z.date()
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
