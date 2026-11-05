"use server";

import { createProjectInputSchema, type Project } from "@nextomic/schema";
import { getDb, projects } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  AccessDeniedError,
  requireProjectAccess,
  requireWorkspaceMembership
} from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

async function requireSession() {
  const sessionData = await getServerSession();
  if (!sessionData) throw new AccessDeniedError("Not signed in.");
  return sessionData;
}

export async function createProjectAction(input: {
  name: string;
  description?: string;
}): Promise<ActionResult<Project>> {
  try {
    const sessionData = await requireSession();
    const parsed = createProjectInputSchema.parse(input);
    const membership = await requireWorkspaceMembership(sessionData.user.id);
    const db = getDb();
    const [project] = await db
      .insert(projects)
      .values({
        workspaceId: membership.workspaceId,
        name: parsed.name,
        description: parsed.description ?? null,
        createdBy: sessionData.user.id
      })
      .returning();
    revalidatePath("/projects");
    return { data: (project as unknown as Project) ?? null, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Could not create the project.") };
  }
}

export async function renameProjectAction(
  projectId: string,
  name: string
): Promise<ActionResult<true>> {
  try {
    const sessionData = await requireSession();
    const parsed = createProjectInputSchema.pick({ name: true }).parse({ name });
    await requireProjectAccess(sessionData.user.id, projectId);
    const db = getDb();
    await db
      .update(projects)
      .set({ name: parsed.name, updatedAt: new Date(), lastModifiedAt: new Date() })
      .where(eq(projects.id, projectId));
    revalidatePath("/projects");
    return { data: true, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Could not rename the project.") };
  }
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult<true>> {
  try {
    const sessionData = await requireSession();
    await requireProjectAccess(sessionData.user.id, projectId);
    const db = getDb();
    await db.delete(projects).where(eq(projects.id, projectId));
    revalidatePath("/projects");
    return { data: true, error: null };
  } catch (error) {
    return { data: null, error: toErrorMessage(error, "Could not delete the project.") };
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AccessDeniedError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
