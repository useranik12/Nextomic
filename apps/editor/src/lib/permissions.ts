import type { WorkspaceRole } from "@nextomic/schema";

export const workspacePermissions: Readonly<Record<WorkspaceRole, readonly string[]>> = {
  owner: ["workspace:manage", "project:manage", "project:edit", "project:view"],
  admin: ["workspace:manage", "project:manage", "project:edit", "project:view"],
  member: ["project:edit", "project:view"]
};

export function hasWorkspacePermission(role: WorkspaceRole, permission: string): boolean {
  return workspacePermissions[role].includes(permission);
}
