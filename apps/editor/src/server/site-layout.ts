import {
  blankRuleContext,
  composePage,
  createTokenResolver,
  buildDynamicContext,
  defaultNotFoundTree,
  emptyPageTree,
  fillTokens,
  isSafeUrl,
  resolveLayout,
  resolveNotFound,
  type DynamicContext,
  type ElementNode,
  type PageSeo,
  type PageSettings,
  type ProjectSettings,
  type PublishedTemplate,
  type RuleContext,
  type Taxonomy
} from "@nextomic/schema";

// Builds what a visitor (or the owner preview) is shown around a page: the header and footer that
// apply, the 404 page, and the facts rules and dynamic tags read.

export interface RequestFacts {
  /** Address as the visitor sees it. */
  url: string;
  host: string;
  path: string;
  query: string;
  referrer: string;
  userAgent: string;
  language: string;
}

export interface ItemMeta {
  id: string;
  status: "draft" | "published" | "modified";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  categoryIds: readonly string[];
  tagIds: readonly string[];
}

/** Browser and operating system from the User-Agent header; unknown parts stay empty. */
export function parseUserAgent(ua: string): {
  browser: { name: string; version: string; isMobile: boolean };
  os: { name: string; device: string };
} {
  const find = (re: RegExp) => re.exec(ua)?.[1] ?? "";
  let browser = { name: "", version: "" };
  if (/Edg\//.test(ua)) browser = { name: "Edge", version: find(/Edg\/(\d+)/) };
  else if (/OPR\//.test(ua)) browser = { name: "Opera", version: find(/OPR\/(\d+)/) };
  else if (/Firefox\//.test(ua)) browser = { name: "Firefox", version: find(/Firefox\/(\d+)/) };
  else if (/Chrome\//.test(ua)) browser = { name: "Chrome", version: find(/Chrome\/(\d+)/) };
  else if (/Safari\//.test(ua)) browser = { name: "Safari", version: find(/Version\/(\d+)/) };
  const mobile = /Mobi|Android|iPhone|iPad/.test(ua);
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const device = /iPad|Tablet/.test(ua) ? "tablet" : mobile ? "mobile" : ua ? "desktop" : "";
  return { browser: { ...browser, isMobile: mobile }, os: { name: os, device } };
}

const names = (terms: Taxonomy["pageCategories"], ids: readonly string[]) =>
  ids
    .map((id) => terms.find((t) => t.id === id)?.name)
    .filter((n): n is string => Boolean(n))
    .join(", ");

/** The values behind {{page.*}} and {{template.*}} tags. */
export function metaFields(
  meta: ItemMeta,
  categories: Taxonomy["pageCategories"],
  tags: Taxonomy["pageTags"]
) {
  return {
    id: meta.id,
    status: meta.status,
    createdBy: meta.createdBy,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    publishedAt: meta.publishedAt,
    categories: names(categories, meta.categoryIds),
    tags: names(tags, meta.tagIds)
  };
}

/** The facts rules compare against, for one request. Browser-only facts stay unknown. */
export function serverRuleContext(input: {
  kind: "page" | "template";
  templateType?: string;
  page: { id: string; name: string; route: string; createdBy: string; publishedAt: string };
  params: Record<string, string>;
  request: RequestFacts;
  resolveTag: (tag: string) => string;
  projectId: string;
  now?: Date;
}): RuleContext {
  const ua = parseUserAgent(input.request.userAgent);
  return blankRuleContext({
    kind: input.kind,
    templateType: input.templateType ?? "",
    page: { ...input.page, params: input.params, state: {} },
    nowIso: (input.now ?? new Date()).toISOString(),
    browser: { ...ua.browser, language: input.request.language },
    os: ua.os,
    url: {
      full: input.request.url,
      host: input.request.host,
      path: input.request.path,
      query: input.request.query,
      referrer: input.request.referrer
    },
    user: { ...blankRuleContext().user, projectId: input.projectId },
    resolveTag: input.resolveTag
  });
}

export interface PageLayoutInput {
  tree: ElementNode;
  templates: readonly PublishedTemplate[];
  settings: ProjectSettings;
  page: { id: string; name: string; route: string; settings: PageSettings; meta: ItemMeta };
  params: Record<string, string>;
  request: RequestFacts;
  mode: DynamicContext["mode"];
  creatorName: string;
  projectId: string;
}

/** The page tree inside its header and footer, and the dynamic context the renderer needs. */
export function layoutForPage(input: PageLayoutInput): {
  tree: ElementNode;
  dynamic: DynamicContext;
} {
  const { settings, page } = input;
  const dynamic = buildDynamicContext({
    page: {
      name: page.name,
      route: page.route,
      settings: page.settings,
      meta: metaFields(page.meta, settings.taxonomy.pageCategories, settings.taxonomy.pageTags)
    },
    tree: input.tree,
    mode: input.mode,
    paramValues: input.params,
    query: input.request.query
  });
  const ctx = serverRuleContext({
    kind: "page",
    page: {
      id: page.id,
      name: page.name,
      route: page.route,
      createdBy: input.creatorName,
      publishedAt: page.meta.publishedAt
    },
    params: dynamic.params,
    request: input.request,
    resolveTag: createTokenResolver(dynamic),
    projectId: input.projectId
  });
  const layout = resolveLayout(
    input.templates.map((t) => ({ ...t })),
    { header: page.settings.header, footer: page.settings.footer },
    ctx
  );
  return {
    tree: composePage(
      input.tree,
      layout.header?.tree ?? null,
      layout.footer?.tree ?? null,
      layout.header?.settings.sticky
    ),
    dynamic
  };
}

/** The page's SEO fields with dynamic tags filled in. A link that resolves to something unsafe is dropped. */
export function resolveSeo(
  input: Pick<PageLayoutInput, "tree" | "settings" | "page" | "params" | "request" | "mode">
): PageSeo {
  const dynamic = buildDynamicContext({
    page: {
      name: input.page.name,
      route: input.page.route,
      settings: input.page.settings,
      meta: metaFields(
        input.page.meta,
        input.settings.taxonomy.pageCategories,
        input.settings.taxonomy.pageTags
      )
    },
    tree: input.tree,
    mode: input.mode,
    paramValues: input.params,
    query: input.request.query
  });
  const fill = (text: string) => fillTokens(text, createTokenResolver(dynamic)).trim();
  const url = (text: string) => {
    const value = fill(text);
    return isSafeUrl(value) && !value.startsWith("{{") ? value : "";
  };
  const seo = input.page.settings.seo;
  return {
    title: fill(seo.title),
    description: fill(seo.description),
    canonical: url(seo.canonical),
    robots: seo.robots,
    ogTitle: fill(seo.ogTitle),
    ogDescription: fill(seo.ogDescription),
    ogImage: url(seo.ogImage)
  };
}

/** The 404 page: the best published 404 template inside its own header and footer, or a plain default. */
export function layoutForNotFound(input: {
  templates: readonly PublishedTemplate[];
  settings: ProjectSettings;
  request: RequestFacts;
  mode: DynamicContext["mode"];
  projectId: string;
}): { tree: ElementNode; dynamic: DynamicContext; themeId: string | null } {
  const root = emptyPageTree();
  const dynamic = buildDynamicContext({
    page: { name: "Not found", route: input.request.path, settings: { params: [], state: [] } },
    mode: input.mode,
    query: input.request.query
  });
  const ctx = serverRuleContext({
    kind: "template",
    templateType: "error-404",
    page: { id: "", name: "Not found", route: input.request.path, createdBy: "", publishedAt: "" },
    params: {},
    request: input.request,
    resolveTag: createTokenResolver(dynamic),
    projectId: input.projectId
  });
  const found = resolveNotFound(
    input.templates.map((t) => ({ ...t })),
    ctx
  );
  if (!found) return { tree: defaultNotFoundTree(root), dynamic, themeId: null };
  const layout = resolveLayout(
    input.templates.map((t) => ({ ...t })),
    { header: found.settings.header, footer: found.settings.footer },
    ctx
  );
  return {
    tree: composePage(
      found.tree,
      layout.header?.tree ?? null,
      layout.footer?.tree ?? null,
      layout.header?.settings.sticky
    ),
    dynamic,
    themeId: found.settings.themeId
  };
}
