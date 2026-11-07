import { BASE_CSS, PageRenderer } from "@nextomic/renderer";
import { AnimationPlayer } from "@/components/runtime/animation-player";
import {
  buildDynamicContext,
  composePage,
  emptyPageTree,
  type ElementNode,
  type ProjectSettings,
  type PublishedTemplate,
  collectElementAnimations,
  customCssFor,
  elementAnimationCss,
  resolveTheme,
  timelinesForPage
} from "@nextomic/schema";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import { getPageByRoute, getProjectSettings, listPages, type StoredPage } from "@/server/pages";
import { requestFacts } from "@/server/request-facts";
import {
  layoutForNotFound,
  layoutForPage,
  resolveSeo,
  type RequestFacts
} from "@/server/site-layout";
import { getDraftTemplates, getTemplate } from "@/server/templates";

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
  const { page, settings } = await resolvePreview(
    id,
    typeof search.path === "string" ? search.path : undefined
  );
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (key !== "path" && typeof value === "string") values[key] = value;
  }
  const seo = resolveSeo({
    tree: page.tree,
    settings,
    page: {
      id: page.id,
      name: page.name,
      route: page.route,
      settings: page.settings,
      meta: {
        id: page.id,
        status: "draft",
        createdBy: "",
        createdAt: "",
        updatedAt: page.updatedAt.toISOString(),
        publishedAt: "",
        categoryIds: page.settings.categoryIds,
        tagIds: page.settings.tagIds
      }
    },
    params: values,
    request: requestFacts(await headers(), page.route, new URLSearchParams(values).toString()),
    mode: "preview"
  });
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
/** A template shown the way it will look: a header or footer around sample content, a 404 as is. */
async function previewTemplate(
  projectId: string,
  templateId: string,
  page: StoredPage,
  settings: ProjectSettings,
  all: readonly PublishedTemplate[],
  request: RequestFacts
) {
  const stored = await getTemplate(projectId, templateId);
  if (!stored) return null;
  const forced = {
    id: stored.id,
    type: stored.type,
    name: stored.name,
    settings: { ...stored.settings, status: "published" as const },
    tree: stored.tree
  };
  if (stored.type === "error-404") {
    const others = all.filter((t) => t.id !== stored.id);
    return layoutForNotFound({
      templates: [...others, forced],
      settings,
      request,
      mode: "preview",
      projectId
    });
  }
  const sample = sampleContent();
  const dynamic = buildDynamicContext({
    page: { name: page.name, route: page.route, settings: page.settings },
    mode: "preview"
  });
  return {
    tree:
      stored.type === "header"
        ? composePage(sample, stored.tree, null, stored.settings.sticky)
        : composePage(sample, null, stored.tree),
    dynamic,
    rules: undefined
  };
}

/** Stand-in page content so a header or footer is seen in place. */
function sampleContent(): ElementNode {
  const root = emptyPageTree();
  return {
    ...root,
    children: [
      {
        id: "sample-content",
        type: "text",
        name: "Page content",
        htmlTag: "p",
        classIds: [],
        props: { text: "Page content appears here." },
        styles: { breakpoints: {} },
        actions: {},
        children: []
      }
    ]
  };
}

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
  const incoming = await headers();
  const request = requestFacts(incoming, page.route, new URLSearchParams(values).toString());
  const draftTemplates = await getDraftTemplates(id);
  const templateId = typeof search.template === "string" ? search.template : null;
  const shown = templateId
    ? await previewTemplate(id, templateId, page, settings, draftTemplates, request)
    : null;
  const laid =
    shown ??
    layoutForPage({
      tree: page.tree,
      templates: draftTemplates,
      settings,
      page: {
        id: page.id,
        name: page.name,
        route: page.route,
        settings: page.settings,
        meta: {
          id: page.id,
          status: "draft",
          createdBy: "",
          createdAt: "",
          updatedAt: page.updatedAt.toISOString(),
          publishedAt: "",
          categoryIds: page.settings.categoryIds,
          tagIds: page.settings.tagIds
        }
      },
      params: values,
      request,
      mode: "preview",
      creatorName: "",
      projectId: id
    });
  const { tree, dynamic } = laid;
  const { theme } = resolveTheme(settings.themes, {
    pageId: page.id,
    route: page.route,
    forcedThemeId: page.settings.themeId,
    rules: laid.rules
  });
  return (
    <>
      <style>{BASE_CSS + elementAnimationCss(tree)}</style>
      <AnimationPlayer
        timelines={timelinesForPage(settings.animations, page.id)}
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
        customCss={customCssFor(settings.cssFiles, page.id)}
        dynamic={dynamic}
        bootScript
        pruneUnusedClasses
      />
    </>
  );
}
