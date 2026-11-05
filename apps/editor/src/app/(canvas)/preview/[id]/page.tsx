import { PageRenderer } from "@nextomic/renderer";
import { notFound, redirect } from "next/navigation";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import { getPageByRoute, getProjectSettings, listPages } from "@/server/pages";

export const metadata = { title: "Preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Walking skeleton: renders the SAVED draft of a page through the same renderer the exporter
// will use. Owner-only; it is not the published site.
export default async function PreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const { id } = await params;
  const { path } = await searchParams;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/sign-in");

  try {
    await requireProjectAccess(sessionData.user.id, id);
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound();
    throw error;
  }

  const settings = await getProjectSettings(id);
  const requested = typeof path === "string" && path.startsWith("/") ? path : null;
  let page = requested ? await getPageByRoute(id, requested) : null;
  if (!page) {
    const pages = await listPages(id);
    const home = pages.find((p) => p.isHome) ?? pages[0];
    page = home ? await getPageByRoute(id, home.route) : null;
  }
  if (!page) notFound();

  return <PageRenderer tree={page.tree} breakpoints={settings.breakpoints} />;
}
