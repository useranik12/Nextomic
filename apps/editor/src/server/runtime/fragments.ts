import { pageCss, renderNode } from "@nextomic/renderer";
import {
  applyElementEdits,
  applyRefreshes,
  createTokenResolver,
  findNode,
  isOverlayType,
  loopInstances,
  type DynamicContext,
  type ElementEdits,
  type ElementNode,
  type LoopRows,
  type ElementQuery,
  type RefreshRequest,
  type ProjectSettings,
  type PublishedTemplate,
  withTemplateParams
} from "@nextomic/schema";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FragmentPart, OverlayPart } from "@nextomic/runtime";
import { loopFreeIds } from "@/server/runtime/loop-free";

// Server fragments (owner decision 2026-11-10): after an action changes state, the runtime asks
// for the elements that read it, rendered here with the new state by the same renderer as the
// first load. An element whose conditions now fail comes back as an empty slot, so hidden content
// never reaches the browser before its condition passes.

export const MAX_FRAGMENT_IDS = 50;

/** Only top-level values the page declares may be replaced, as text of bounded size. */
export function withClientState(
  dynamic: DynamicContext,
  app: Readonly<Record<string, string>>,
  state: Readonly<Record<string, string>>
): DynamicContext {
  const pick = (base: Record<string, string>, given: Readonly<Record<string, string>>) => {
    const out = { ...base };
    for (const [name, value] of Object.entries(given)) if (name in base) out[name] = value;
    return out;
  };
  return { ...dynamic, app: pick(dynamic.app, app), state: pick(dynamic.state, state) };
}

/**
 * Redraws elements of a page. The visitor's class, ID and attribute edits and the saved queries
 * of Refresh Query actions are applied to the tree first (both are validated, bounded input).
 * `loopRows` runs the query loops inside an element (the endpoint runs them on the server).
 */
export async function renderParts(input: {
  tree: ElementNode;
  dynamic: DynamicContext;
  settings: ProjectSettings;
  ids: readonly string[];
  edits?: ElementEdits;
  /** Loops Refresh Query ran, and how to find each action's saved query. */
  refreshes?: RefreshRequest;
  savedQuery?: (nodeId: string, loopId: string) => ElementQuery | null;
  loopRows?: (node: ElementNode) => Promise<LoopRows>;
}): Promise<FragmentPart[]> {
  const resolveToken = createTokenResolver(input.dynamic);
  const tree = applyRefreshes(
    applyElementEdits(input.tree, input.edits ?? {}),
    input.refreshes ?? {},
    input.savedQuery ?? (() => null)
  );
  const free = loopFreeIds(tree);
  const parts: FragmentPart[] = [];
  for (const id of input.ids.slice(0, MAX_FRAGMENT_IDS)) {
    const node = free.has(id) ? findNode(tree, id)?.node : null;
    if (!node) continue;
    const hasLoops = loopInstances(node, {}, 1).length > 0;
    const loopRows = hasLoops ? await input.loopRows?.(node) : undefined;
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        renderNode(node, {
          breakpoints: input.settings.breakpoints,
          classes: input.settings.classes,
          dynamic: input.dynamic,
          resolveToken,
          tree,
          liveSlots: true,
          ...(loopRows ? { loopRows } : {})
        })
      )
    );
    parts.push({ id, html, css: pageCss(node, input.settings.breakpoints, {}, resolveToken) });
  }
  return parts;
}

/** A modal or bottom sheet: the template's content with its parameters filled from the values the action passed. */
export function renderOverlay(input: {
  template: PublishedTemplate;
  rank: number;
  dynamic: DynamicContext;
  settings: ProjectSettings;
  params: Readonly<Record<string, string>>;
}): OverlayPart {
  const { template, settings } = input;
  if (!isOverlayType(template.type)) throw new Error("Not a modal or bottom sheet template.");
  const dynamic = withTemplateParams(input.dynamic, template.settings.params, input.params);
  const resolveToken = createTokenResolver(dynamic);
  const options = {
    breakpoints: settings.breakpoints,
    classes: settings.classes,
    dynamic,
    resolveToken,
    tree: template.tree
  };
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      ...template.tree.children.map((child) => renderNode(child, options))
    )
  );
  // Class styles come along: the page may not use the template's classes.
  const css = pageCss(template.tree, settings.breakpoints, settings.classes, resolveToken);
  return {
    templateId: template.id,
    type: template.type,
    html,
    css,
    overlay: template.settings.overlay,
    entry: template.settings.entry,
    rank: input.rank
  };
}
