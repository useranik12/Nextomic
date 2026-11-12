import type { NextApiRequest } from "next";
import type { NextomicUser } from "@nextomic/schema";
import { auth } from "@/lib/auth";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { nextomicUserOf } from "@/server/nextomic-user";

// Request helpers shared by the site endpoints the action runtime calls (fragment, action).

export function headersOf(request: NextApiRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  return headers;
}

export function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const visitorKey = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";

/** The builder account of a preview request when it is a signed-in member of the project. */
export async function previewMember(
  projectId: string,
  headers: Headers
): Promise<NextomicUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  try {
    await requireProjectAccess(session.user.id, projectId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return null;
    throw error;
  }
  return nextomicUserOf(session.user);
}
