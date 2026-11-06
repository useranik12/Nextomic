import { BASE_CSS, PageRenderer } from "@nextomic/renderer";
import { AnimationPlayer } from "@/components/runtime/animation-player";
import {
  buildDynamicContext,
  customCssFor,
  resolveTheme,
  timelinesForPage
} from "@nextomic/schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPublishedView } from "@/server/publish";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; path?: string[] }>;

// Public, no session: only the published snapshot is ever served. Drafts live behind /preview.
const resolve = cache(async (id: string, path: string[] | undefined) => {
  const route = path && path.length > 0 ? `/${path.map(decodeURIComponent).join("/")}` : null;
  const view = await getPublishedView(id, route);
  if (!view) notFound();
  return view;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, path } = await params;
  const { page } = await resolve(id, path);
  const seo = page.settings.seo;
  return {
    title: seo.title || page.name,
    description: seo.description || undefined,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: { index: seo.robots === "index", follow: seo.robots === "index" },
    openGraph: {
      title: seo.ogTitle || seo.title || page.name,
      description: seo.ogDescription || seo.description || undefined,
      images: seo.ogImage ? [seo.ogImage] : undefined
    }
  };
}

export default async function PublishedPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, path } = await params;
  const search = await searchParams;
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") values[key] = value;
  }
  const { page, pageId, settings } = await resolve(id, path);
  const { theme } = resolveTheme(settings.themes, {
    pageId,
    route: page.route,
    forcedThemeId: page.settings.themeId
  });
  return (
    <>
      <style>{BASE_CSS}</style>
      <AnimationPlayer timelines={timelinesForPage(settings.animations, pageId)} />
      <PageRenderer
        tree={page.tree}
        breakpoints={settings.breakpoints}
        classes={settings.classes}
        variables={settings.variables}
        fonts={settings.fonts}
        fontBase={`/fonts/${id}`}
        theme={theme}
        customCss={customCssFor(settings.cssFiles, pageId, { minify: true })}
        dynamic={buildDynamicContext({
          page: { name: page.name, route: page.route, settings: page.settings },
          tree: page.tree,
          mode: "live",
          paramValues: values,
          query: new URLSearchParams(values).toString()
        })}
        bootScript
        pruneUnusedClasses
      />
    </>
  );
}
