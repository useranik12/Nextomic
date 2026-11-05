import { Button } from "@heroui/react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

export default async function EditorPlaceholderPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/sign-in");

  let projectName: string;
  try {
    const { project } = await requireProjectAccess(sessionData.user.id, id);
    projectName = project.name;
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <h1 className="text-2xl font-semibold text-foreground">{projectName}</h1>
      <p className="max-w-md text-default-500">
        The page editor arrives in Phase 1. Your project was created and is saved — come back once
        the editor shell ships.
      </p>
      <Button as={Link} href="/projects" color="primary">
        Back to All Projects
      </Button>
    </div>
  );
}
