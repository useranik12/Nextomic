import { BASE_CSS, PageRenderer } from "@nextomic/renderer";
import { buildDynamicContext, customCssFor, resolveTheme } from "@nextomic/schema";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import { getPageByRoute, getProjectSettings, listPages } from "@/server/pages";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

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
  const search = await searchParams;
  const { page } = await resolvePreview(
    id,
    typeof search.path === "string" ? search.path : undefined
  );
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
  const search = await searchParams;
  const path = typeof search.path === "string" ? search.path : undefined;
  const { page, settings } = await resolvePreview(id, path);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (key !== "path" && typeof value === "string") values[key] = value;
  }
  const { theme } = resolveTheme(settings.themes, {
    pageId: page.id,
    route: page.route,
    forcedThemeId: page.settings.themeId
  });
  return (
    <>
      <style>{BASE_CSS}</style>
      <PageRenderer
        tree={page.tree}
        breakpoints={settings.breakpoints}
        classes={settings.classes}
        variables={settings.variables}
        fonts={settings.fonts}
        fontBase={`/fonts/${id}`}
        theme={theme}
        customCss={customCssFor(settings.cssFiles, page.id)}
        dynamic={buildDynamicContext({
          page: { name: page.name, route: page.route, settings: page.settings },
          tree: page.tree,
          mode: "preview",
          paramValues: values,
          query: new URLSearchParams(values).toString()
        })}
        bootScript
        pruneUnusedClasses
      />
    </>
  );
}
