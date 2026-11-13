import { ConnectorError } from "@nextomic/integrations";
import { z } from "zod";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

export type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

const idSchema = z.string().min(1).max(100);

/** Signs in the caller and checks project access. Returns the user and the project's workspace. */
export async function authorizeProjectMember(
  projectId: string
): Promise<{ userId: string; workspaceId: string }> {
  const parsed = idSchema.safeParse(projectId);
  if (!parsed.success) throw new AccessDeniedError();
  const session = await getServerSession();
  if (!session) throw new AccessDeniedError("Sign in to continue.");
  const { membership } = await requireProjectAccess(session.user.id, parsed.data);
  return { userId: session.user.id, workspaceId: membership.workspaceId };
}

/** Every server action on a project calls this first. Returns the signed-in user's id. */
export async function authorizeProject(projectId: string): Promise<string> {
  return (await authorizeProjectMember(projectId)).userId;
}

export function failResult<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof AccessDeniedError) return { data: null, error: error.message };
  if (error instanceof ConnectorError) return { data: null, error: error.message };
  if (error instanceof z.ZodError) {
    return { data: null, error: error.issues[0]?.message ?? "Invalid input." };
  }
  if (
    error instanceof Error &&
    (error.name === "FontError" || error.name === "MediaError" || error.name === "IconError")
  )
    return { data: null, error: error.message };
  return { data: null, error: fallback };
}
