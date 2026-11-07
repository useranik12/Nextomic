import { notFound, redirect } from "next/navigation";
import { supabaseTableNames } from "@/server/connectors/supabase-schema";
import { currentNextomicUser } from "@/server/nextomic-user";
import { EditorShell } from "@/components/editor/editor-shell";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import { ensureHomePage, getPage, getProjectSettings, listPages } from "@/server/pages";

export const metadata = { title: "Editor" };

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/sign-in");

  try {
    await requireProjectAccess(sessionData.user.id, id);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }

  await ensureHomePage(id, sessionData.user.id);
  const [project, pages, supabaseTables, nextomicUser] = await Promise.all([
    getProjectSettings(id),
    listPages(id),
    supabaseTableNames(id),
    currentNextomicUser()
  ]);
  const first = pages.find((page) => page.isHome) ?? pages[0];
  const page = first ? await getPage(id, first.id) : null;
  if (!page) notFound();

  return (
    <EditorShell
      projectId={id}
      project={project}
      initialPages={pages}
      initialPage={page}
      supabaseTables={supabaseTables}
      nextomicUser={nextomicUser}
    />
  );
}
