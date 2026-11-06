import { z } from "zod";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

export type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

const idSchema = z.string().min(1).max(100);

/** Every server action on a project calls this first. Returns the signed-in user's id. */
export async function authorizeProject(projectId: string): Promise<string> {
  const parsed = idSchema.safeParse(projectId);
  if (!parsed.success) throw new AccessDeniedError();
  const session = await getServerSession();
  if (!session) throw new AccessDeniedError("Sign in to continue.");
  await requireProjectAccess(session.user.id, parsed.data);
  return session.user.id;
}

export function failResult<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof AccessDeniedError) return { data: null, error: error.message };
  if (error instanceof z.ZodError) {
    return { data: null, error: error.issues[0]?.message ?? "Invalid input." };
  }
  if (error instanceof Error && error.name === "FontError")
    return { data: null, error: error.message };
  return { data: null, error: fallback };
}
