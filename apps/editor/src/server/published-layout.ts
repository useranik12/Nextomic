import { getPublishedView, type PublishedView } from "@/server/publish";
import { dynamicUser, visitorState, type Visitor } from "@/server/runtime/auth-session";
import { requestFacts } from "@/server/request-facts";
import { layoutForPage } from "@/server/site-layout";
import { getPublishedTemplates } from "@/server/templates";

// The laid-out tree and dynamic context of a published page, shared by the page render and the
// site loop endpoint, so both see the same templates, parameters and request facts.

/** How a live page request stands with the session (docs/app-auth.md section 4). */
export interface GatedView {
  view: PublishedView;
  visitor: Visitor | null;
  /**
   * ok: serve it. login: the page needs a signed-in visitor and there is none. expired: the
   * session ran out and must be renewed where cookies can be written.
   */
  state: "ok" | "login" | "expired";
}

/** The live page at a route with the visitor's session checked, or null when nothing is published there. */
export async function gatedView(
  projectId: string,
  route: string | null,
  headers: Headers
): Promise<GatedView | null> {
  const view = await getPublishedView(projectId, route, { includeProtected: true });
  if (!view) return null;
  const session = await visitorState("live", projectId, headers, view.settings.appAuth);
  if (session.kind === "signedIn") return { view, visitor: session.visitor, state: "ok" };
  if (session.kind === "expired") return { view, visitor: null, state: "expired" };
  return { view, visitor: null, state: view.requiresAuth ? "login" : "ok" };
}

export async function publishedLayout(
  projectId: string,
  view: PublishedView,
  values: Readonly<Record<string, string>>,
  headers: Headers,
  visitor: Visitor | null = null
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
    projectId,
    user: dynamicUser(visitor, settings.appAuth)
  });
}

export { getPublishedView };
