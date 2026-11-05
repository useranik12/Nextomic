import { z } from "zod";

export const createProjectInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const projectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastModifiedAt: z.date()
});
export type Project = z.infer<typeof projectSchema>;
