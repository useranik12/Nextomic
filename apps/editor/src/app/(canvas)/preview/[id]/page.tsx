import { PageRenderer } from "@nextomic/renderer";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import { getPageByRoute, getProjectSettings, listPages } from "@/server/pages";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ path?: string }>;

// Owner-only lookup shared by the page and its metadata (cached per request).
const resolvePreview = cache(async (id: string, path: string | undefined) => {
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
  return { page, settings };
});

// Preview applies the page's SEO fields so they can be checked before publishing. The preview
// itself is never indexed.
export async function generateMetadata({
  params,
  searchParams
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const { id } = await params;
  const { path } = await searchParams;
  const { page } = await resolvePreview(id, path);
  const seo = page.settings.seo;
  return {
    title: seo.title || page.name,
    description: seo.description || undefined,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: { index: false, follow: false },
    openGraph: {
      title: seo.ogTitle || seo.title || page.name,
      description: seo.ogDescription || seo.description || undefined,
      images: seo.ogImage ? [seo.ogImage] : undefined
    }
  };
}

// Renders the SAVED draft of a page through the same renderer the exporter will use. Owner-only;
// it is not the published site.
export default async function PreviewPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const { path } = await searchParams;
  const { page, settings } = await resolvePreview(id, path);
  return (
    <PageRenderer tree={page.tree} breakpoints={settings.breakpoints} classes={settings.classes} />
  );
}
