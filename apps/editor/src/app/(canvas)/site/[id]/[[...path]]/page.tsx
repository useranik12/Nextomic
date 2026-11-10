import { BASE_CSS, PageRenderer } from "@nextomic/renderer";
import { AnimationPlayer } from "@/components/runtime/animation-player";
import {
  collectElementAnimations,
  customCssFor,
  elementAnimationCss,
  resolveTheme,
  timelinesForPage
} from "@nextomic/schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { publishedLayout } from "@/server/published-layout";
import { getPublishedView } from "@/server/publish";
import { ActionRuntime } from "@/components/runtime/action-runtime";
import { LoopRuntime } from "@/components/runtime/loop-runtime";
import { livePayload } from "@/server/runtime/page-runtime";
import {
  pageLoopRows,
  projectWorkspaceId,
  realtimeConnection,
  siteExecutor,
  usesRealtime
} from "@/server/queries/run-query";
import { requestFacts } from "@/server/request-facts";
import { resolveSeo } from "@/server/site-layout";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; path?: string[] }>;

// Public, no session: only the published snapshot is ever served. Drafts live behind /preview.
const resolve = cache(async (id: string, path: string[] | undefined) => {
  const route = path && path.length > 0 ? `/${path.map(decodeURIComponent).join("/")}` : null;
  const view = await getPublishedView(id, route);
  if (!view) notFound();
  return view;
});

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id, path } = await params;
  const search = await searchParams;
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") values[key] = value;
  }
  const { page, pageId, settings, meta } = await resolve(id, path);
  const seo = resolveSeo({
    tree: page.tree,
    settings,
    page: {
      id: pageId,
      name: page.name,
      route: page.route,
      settings: page.settings,
      meta: {
        id: pageId,
        status: "published",
        ...meta,
        categoryIds: page.settings.categoryIds,
        tagIds: page.settings.tagIds
      }
    },
    params: values,
    request: requestFacts(await headers(), page.route, new URLSearchParams(values).toString()),
    mode: "live"
  });
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
  const view = await resolve(id, path);
  const { page, pageId, settings, publishedAt } = view;
  const laid = await publishedLayout(id, view, values, await headers());
  const { tree, dynamic, rules } = laid;
  const actions = await livePayload(id, view, laid, new URLSearchParams(values).toString());
  const workspaceId = await projectWorkspaceId(id);
  const loopRows = workspaceId
    ? await pageLoopRows({ projectId: id, tree, dynamic, execute: siteExecutor(id, workspaceId) })
    : {};
  const hasLoops = Object.keys(loopRows).length > 0;
  const realtime = hasLoops && usesRealtime(tree) ? await realtimeConnection(id) : null;
  const { theme } = resolveTheme(settings.themes, {
    pageId,
    route: page.route,
    forcedThemeId: page.settings.themeId,
    rules
  });
  return (
    <>
      <style>{BASE_CSS + elementAnimationCss(tree)}</style>
      <AnimationPlayer
        timelines={timelinesForPage(settings.animations, pageId)}
        elementAnimations={collectElementAnimations(tree)}
      />
      <PageRenderer
        tree={tree}
        breakpoints={settings.breakpoints}
        classes={settings.classes}
        variables={settings.variables}
        fonts={settings.fonts}
        fontBase={`/fonts/${id}`}
        theme={theme}
        themeStylesheet={
          theme ? `/theme-css/${id}/${theme.slug}.css?v=${publishedAt.getTime()}` : undefined
        }
        customCss={customCssFor(settings.cssFiles, pageId, { minify: true })}
        dynamic={dynamic}
        loopRows={loopRows}
        loopMarkers
        bootScript
        pruneUnusedClasses
        liveSlots={actions !== null}
      />
      {actions ? <ActionRuntime payload={actions} /> : null}
      {hasLoops ? <LoopRuntime projectId={id} route={page.route} realtime={realtime} /> : null}
    </>
  );
}
