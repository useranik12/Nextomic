import { getDb, projects, workspaces } from "@nextomic/db";
import { desc, eq } from "drizzle-orm";
import { ProjectsBoard } from "@/components/projects/projects-board";
import { requireWorkspaceMembership } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: shouldOpenNewProject } = await searchParams;
  const sessionData = await getServerSession();
  if (!sessionData) return null; // layout already redirects unauthenticated users

  const membership = await requireWorkspaceMembership(sessionData.user.id);
  const db = getDb();

  const [workspace, projectRows] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, membership.workspaceId)).limit(1),
    db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, membership.workspaceId))
      .orderBy(desc(projects.lastModifiedAt))
  ]);

  return (
    <ProjectsBoard
      workspaceName={workspace[0]?.name ?? "Your Workspace"}
      initialProjects={projectRows}
      openNewProjectOnLoad={shouldOpenNewProject === "1"}
    />
  );
}
