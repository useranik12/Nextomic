import { z } from "zod";

export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const storageDriverSchema = z.enum(["local", "s3"]);
export type StorageDriver = z.infer<typeof storageDriverSchema>;
