import { BASE_CSS, PageRenderer } from "@nextomic/renderer";
import { ActionRuntime } from "@/components/runtime/action-runtime";
import { AnimationPlayer } from "@/components/runtime/animation-player";
import {
  buildDynamicContext,
  composePage,
  frameOverlayTemplate,
  isOverlayType,
  emptyPageTree,
  type ElementNode,
  type ProjectSettings,
  type PublishedTemplate,
  collectElementAnimations,
  customCssFor,
  elementAnimationCss,
  resolveRenderTheme,
  themeChoiceOf,
  themeSwitching,
  timelinesForPage
} from "@nextomic/schema";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import { currentNextomicUser } from "@/server/nextomic-user";
import { getPageByRoute, getProjectSettings, listPages, type StoredPage } from "@/server/pages";
import type { ProxyCaller } from "@/server/connectors/proxy";
import { asVisitor, editorExecutor, pageLoopRows } from "@/server/queries/run-query";
import { dynamicUser, visitorState } from "@/server/runtime/auth-session";
import { requestFacts } from "@/server/request-facts";
import { previewPayload } from "@/server/runtime/page-runtime";
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

  let workspaceId: string;
  try {
    ({
      membership: { workspaceId }
    } = await requireProjectAccess(sessionData.user.id, id));
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
  const caller: ProxyCaller = { userId: sessionData.user.id, projectId: id, workspaceId };
  return { page, settings, caller };
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
  if (isOverlayType(stored.type)) {
    // Shown open: the template over its own overlay, centered or at the bottom.
    return {
      tree: frameOverlayTemplate(stored.tree, stored.type, stored.settings.overlay),
      dynamic: buildDynamicContext({
        page: { name: page.name, route: page.route, settings: page.settings },
        mode: "preview",
        globals: settings
      }),
      rules: undefined
    };
  }
  const sample = sampleContent();
  const dynamic = buildDynamicContext({
    page: { name: page.name, route: page.route, settings: page.settings },
    mode: "preview",
    globals: settings
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
  const { page, settings, caller } = await resolvePreview(id, path);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (key !== "path" && typeof value === "string") values[key] = value;
  }
  const incoming = await headers();
  // A visitor session that ran out is renewed by a route that can write cookies, then the preview returns.
  const sessionState = await visitorState("preview", id, incoming, settings.appAuth);
  if (sessionState.kind === "expired") {
    const here = `${page.route}${Object.keys(values).length > 0 ? `?${new URLSearchParams(values)}` : ""}`;
    redirect(`/api/site/${id}/auth/refresh?mode=preview&next=${encodeURIComponent(here)}`);
  }
  const visitor = sessionState.kind === "signedIn" ? sessionState.visitor : null;
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
      nextomicUser: await currentNextomicUser(),
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
      projectId: id,
      user: dynamicUser(visitor, settings.appAuth)
    });
  const { tree, dynamic } = laid;
  // Template previews (sample content around a header or footer) run no actions.
  const actions =
    "templateIds" in laid
      ? await previewPayload(id, page, settings, laid, new URLSearchParams(values).toString())
      : null;
  const loopRows = await pageLoopRows({
    projectId: id,
    tree,
    dynamic,
    execute: asVisitor(editorExecutor(caller), visitor?.accessToken)
  });
  const { theme } = resolveRenderTheme(settings.themes, {
    pageId: page.id,
    route: page.route,
    forcedThemeId: page.settings.themeId,
    rules: laid.rules
  });
  const otherThemes = themeSwitching(settings.themes, theme, Boolean(page.settings.themeId));
  const runtime = actions
    ? {
        ...actions,
        themes: theme && otherThemes.length > 0 ? [theme, ...otherThemes].map(themeChoiceOf) : []
      }
    : null;
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
        otherThemes={otherThemes}
        customCss={customCssFor(settings.cssFiles, page.id)}
        dynamic={dynamic}
        loopRows={loopRows}
        bootScript
        pruneUnusedClasses
        liveSlots={runtime !== null}
      />
      {runtime ? <ActionRuntime payload={runtime} /> : null}
    </>
  );
}
