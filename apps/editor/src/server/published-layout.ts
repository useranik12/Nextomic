import { getPublishedView, type PublishedView } from "@/server/publish";
import { requestFacts } from "@/server/request-facts";
import { layoutForPage } from "@/server/site-layout";
import { getPublishedTemplates } from "@/server/templates";

// The laid-out tree and dynamic context of a published page, shared by the page render and the
// site loop endpoint, so both see the same templates, parameters and request facts.

export async function publishedLayout(
  projectId: string,
  view: PublishedView,
  values: Readonly<Record<string, string>>,
  headers: Headers
) {
  const { page, pageId, settings, meta } = view;
  const query = new URLSearchParams(values).toString();
  return layoutForPage({
    tree: page.tree,
    templates: await getPublishedTemplates(projectId),
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
    request: requestFacts(headers, page.route, query),
    mode: "live",
    creatorName: meta.createdBy,
    projectId
  });
}

export { getPublishedView };
