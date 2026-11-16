"use server";

import { getDb, projects } from "@nextomic/db";
import { and, desc, eq, ilike } from "drizzle-orm";
import { requireWorkspaceMembership } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

export interface ProjectHit {
  id: string;
  name: string;
}

type Result = { data: ProjectHit[]; error: null } | { data: null; error: string };

const MAX_QUERY = 100;
const MAX_HITS = 8;

/** Escapes LIKE wildcards so a typed % or _ matches itself. */
const literal = (text: string): string =>
  [...text].map((c) => (c === "\\" || c === "%" || c === "_" ? `\\${c}` : c)).join("");

/** Projects of the signed-in user's workspace whose name contains the text (builder search). */
export async function searchProjectsAction(text: string): Promise<Result> {
  const query = String(text ?? "")
    .trim()
    .slice(0, MAX_QUERY);
  if (query === "") return { data: [], error: null };
  const sessionData = await getServerSession();
  if (!sessionData) return { data: null, error: "Not signed in." };
  try {
    const membership = await requireWorkspaceMembership(sessionData.user.id);
    const rows = await getDb()
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, membership.workspaceId),
          ilike(projects.name, `%${literal(query)}%`)
        )
      )
      .orderBy(desc(projects.lastModifiedAt))
      .limit(MAX_HITS);
    return { data: rows, error: null };
  } catch {
    return { data: null, error: "Search is not available right now." };
  }
}
