import { pageCss, renderNode } from "@nextomic/renderer";
import {
  createTokenResolver,
  findNode,
  type DynamicContext,
  type ElementNode,
  type ProjectSettings
} from "@nextomic/schema";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FragmentPart } from "@nextomic/runtime";
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

export function renderParts(input: {
  tree: ElementNode;
  dynamic: DynamicContext;
  settings: ProjectSettings;
  ids: readonly string[];
}): FragmentPart[] {
  const resolveToken = createTokenResolver(input.dynamic);
  const free = loopFreeIds(input.tree);
  const parts: FragmentPart[] = [];
  for (const id of input.ids.slice(0, MAX_FRAGMENT_IDS)) {
    const node = free.has(id) ? findNode(input.tree, id)?.node : null;
    if (!node) continue;
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        renderNode(node, {
          breakpoints: input.settings.breakpoints,
          classes: input.settings.classes,
          dynamic: input.dynamic,
          resolveToken,
          tree: input.tree,
          liveSlots: true
        })
      )
    );
    parts.push({ id, html, css: pageCss(node, input.settings.breakpoints, {}, resolveToken) });
  }
  return parts;
}

/** A toast from the toast template: its root's children with {{ toast.* }} filled. */
export function renderToast(input: {
  template: ElementNode;
  dynamic: DynamicContext;
  settings: ProjectSettings;
  toast: { title: string; message: string; type: string };
}): { html: string; css: string } {
  const dynamic = { ...input.dynamic, toast: input.toast };
  const resolveToken = createTokenResolver(dynamic);
  const options = {
    breakpoints: input.settings.breakpoints,
    classes: input.settings.classes,
    dynamic,
    resolveToken,
    tree: input.template
  };
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      ...input.template.children.map((child) => renderNode(child, options))
    )
  );
  return { html, css: pageCss(input.template, input.settings.breakpoints, {}, resolveToken) };
}
