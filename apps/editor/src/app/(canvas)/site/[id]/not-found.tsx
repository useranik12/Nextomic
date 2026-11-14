import { pageIcons } from "@/server/icon-lookup";
import { BASE_CSS, PageRenderer } from "@nextomic/renderer";
import {
  collectElementAnimations,
  defaultProjectSettings,
  elementAnimationCss,
  resolveRenderTheme,
  themeSwitching
} from "@nextomic/schema";
import { headers } from "next/headers";
import { AnimationPlayer } from "@/components/runtime/animation-player";
import { getPublishedSite } from "@/server/publish";
import { requestFacts } from "@/server/request-facts";
import { layoutForNotFound } from "@/server/site-layout";
import { getPublishedTemplates } from "@/server/templates";

export const dynamic = "force-dynamic";

const SITE_PATH = /^\/site\/([A-Za-z0-9_-]{1,100})(?:\/|$)/;

// Shown for any address the site has no page for. A published, active 404 template is used;
// until the owner makes one, a plain "Page not found" page is shown.
export default async function SiteNotFound() {
  const incoming = await headers();
  const facts = requestFacts(incoming, "/", "");
  const projectId = SITE_PATH.exec(facts.path)?.[1] ?? "";
  const site = projectId ? await getPublishedSite(projectId) : null;
  const settings = site?.settings ?? defaultProjectSettings();
  const templates = site ? await getPublishedTemplates(projectId) : [];
  const {
    tree,
    dynamic: context,
    themeId,
    rules
  } = layoutForNotFound({
    templates,
    settings,
    request: facts,
    mode: "live",
    projectId
  });
  const { theme } = resolveRenderTheme(settings.themes, {
    pageId: "",
    route: "",
    forcedThemeId: themeId,
    rules
  });
  const otherThemes = themeSwitching(settings.themes, theme, Boolean(themeId));
  const drawn = await pageIcons(projectId, settings.iconLibraries, [tree]);
  return (
    <>
      <style>{BASE_CSS + elementAnimationCss(tree)}</style>
      <AnimationPlayer timelines={[]} elementAnimations={collectElementAnimations(tree)} />
      <PageRenderer
        tree={tree}
        breakpoints={settings.breakpoints}
        classes={settings.classes}
        variables={settings.variables}
        fonts={settings.fonts}
        fontBase={`/fonts/${projectId}`}
        theme={theme}
        otherThemes={otherThemes}
        themeStylesheetFor={(slug) =>
          site ? `/theme-css/${projectId}/${slug}.css?v=${site.publishedAt.getTime()}` : ""
        }
        themeStylesheet={
          theme && site
            ? `/theme-css/${projectId}/${theme.slug}.css?v=${site.publishedAt.getTime()}`
            : undefined
        }
        dynamic={context}
        icons={drawn.icons}
        iconCss={drawn.iconCss}
        bootScript
        pruneUnusedClasses
      />
    </>
  );
}
