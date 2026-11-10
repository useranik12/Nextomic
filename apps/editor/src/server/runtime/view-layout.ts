import type { NextomicUser } from "@nextomic/schema";
import { getPageByRoute, getProjectSettings, listPages, type StoredPage } from "@/server/pages";
import { publishedLayout } from "@/server/published-layout";
import { getPublishedView } from "@/server/publish";
import { requestFacts } from "@/server/request-facts";
import { layoutForPage } from "@/server/site-layout";
import { getDraftTemplates } from "@/server/templates";

// The laid-out page (page, header, footer, toast template) of the live site or of the owner
// preview, shared by the page renders and the fragment endpoint so all see the same tree.

const valuesOf = (search: string) => {
  const values: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    if (key !== "path" && key !== "template") values[key] ??= value;
  }
  return values;
};

/** The published page at a route, laid out for this request; null when nothing is published there. */
export async function liveView(projectId: string, route: string, search: string, headers: Headers) {
  const view = await getPublishedView(projectId, route === "/" ? null : route);
  if (!view) return null;
  const laid = await publishedLayout(projectId, view, valuesOf(search), headers);
  return { ...laid, settings: view.settings, pageId: view.pageId, pageFlows: view.page.flows };
}

/** The saved draft of a page (home when the route is unknown), laid out for the owner preview. */
export async function draftView(
  projectId: string,
  route: string | null,
  search: string,
  headers: Headers,
  nextomicUser: NextomicUser | null
) {
  const settings = await getProjectSettings(projectId);
  let page: StoredPage | null = route ? await getPageByRoute(projectId, route) : null;
  if (!page) {
    const pages = await listPages(projectId);
    const home = pages.find((p) => p.isHome) ?? pages[0];
    page = home ? await getPageByRoute(projectId, home.route) : null;
  }
  if (!page) return null;
  const values = valuesOf(search);
  const laid = layoutForPage({
    tree: page.tree,
    templates: await getDraftTemplates(projectId),
    nextomicUser,
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
    request: requestFacts(headers, page.route, new URLSearchParams(values).toString()),
    mode: "preview",
    creatorName: "",
    projectId
  });
  return { ...laid, settings, page };
}
