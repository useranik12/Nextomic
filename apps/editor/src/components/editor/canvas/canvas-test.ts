import { pageCss, renderNode } from "@nextomic/renderer";
import {
  errorValue,
  FlowError,
  LiveState,
  runFlow,
  ElementEditStore,
  createOverlayLayer,
  createToastStack,
  type OverlayPart,
  starterHandlers,
  type RunLogEntry,
  type RuntimePayload
} from "@nextomic/runtime";
import { createTokenResolver, withTemplateParams, type DynamicContext } from "@nextomic/schema";
import { createElement, Fragment } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { CanvasMessage, HostMessage, RenderMessage } from "./protocol";

// Runs INSIDE the canvas iframe: the flow editor's Test. It runs the draft nodes for real on the
// canvas, with its own app and page state (the canvas re-renders with it) and the toast template
// the editor sent. Navigation is reported, never followed, so the editor stays open.

type TestRun = Extract<HostMessage, { type: "test-run" }>;
export type StateOverride = Pick<DynamicContext, "app" | "state">;

interface TesterDeps {
  current: () => RenderMessage | null;
  setOverride: (override: StateOverride | null) => void;
  post: (message: CanvasMessage) => void;
}

/** Log outputs travel through postMessage, so they must be plain data. */
function plain(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

/** A modal or bottom sheet template as the overlay layer needs it, rendered here like the server would. */
function overlayPart(
  templateId: string,
  toast: TestRun["overlays"][string],
  render: RenderMessage,
  dynamic: DynamicContext,
  values: Readonly<Record<string, string>>
) {
  const filled = withTemplateParams(dynamic, toast.params, values);
  const resolveToken = createTokenResolver(filled);
  const options = {
    breakpoints: render.breakpoints,
    classes: render.classes,
    dynamic: filled,
    resolveToken,
    tree: toast.tree
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      createElement(
        Fragment,
        null,
        ...toast.tree.children.map((child) => renderNode(child, options))
      )
    )
  );
  const html = host.innerHTML;
  root.unmount();
  const css = pageCss(toast.tree, render.breakpoints, render.classes, resolveToken);
  return {
    templateId,
    type: toast.type,
    html,
    css,
    overlay: toast.overlay,
    entry: toast.entry,
    rank: toast.rank
  } satisfies OverlayPart;
}

export function createCanvasTester({ current, setOverride, post }: TesterDeps) {
  let controller: AbortController | null = null;
  // Opened by a test run and kept open so the owner sees them; closed when the test ends.
  const overlays = createOverlayLayer();
  const toasts = createToastStack();

  function stop() {
    overlays.destroy();
    toasts.destroy();
    controller?.abort();
    controller = null;
    setOverride(null);
  }

  async function run(message: TestRun) {
    stop();
    const render = current();
    if (!render) return;
    const own = new AbortController();
    controller = own;
    const log = (entry: RunLogEntry) =>
      post({
        type: "test-log",
        runId: message.runId,
        entry: { ...entry, output: plain(entry.output) }
      });
    const payload: RuntimePayload = {
      projectId: "",
      mode: "preview",
      route: render.dynamic.page.route,
      search: "",
      flows: {},
      blocks: message.blocks,
      deps: {},
      rootIds: [],
      dynamic: render.dynamic,
      appState: message.appState,
      routes: message.routes
    };
    const live = new LiveState(payload, {}, null, () => {
      if (controller === own) setOverride({ app: { ...live.app }, state: { ...live.state } });
    });
    const note = (label: string, output: string) =>
      log({ nodeId: "", label, status: "ok", ms: 0, output });
    const handlers = starterHandlers({
      payload,
      state: live,
      log,
      hrefFor: (route, query) => (query.size > 0 ? `${route}?${query.toString()}` : route),
      navigation: {
        open: (href) => note("Navigation", `Would open ${href}; Test stays in the editor.`),
        openTab: (href) => note("Navigation", `Would open ${href} in a new tab.`),
        back: () => note("Navigation", "Would go back; Test stays in the editor."),
        reload: () => note("Navigation", "Would reload the page; Test stays in the editor.")
      },
      // The canvas re-renders from state on its own.
      rebuild: async () => {},
      // Class, ID and attribute changes show on the canvas element itself; conditions and loops
      // are not re-checked in Test (the server redraws them on the preview and live site).
      edits: new ElementEditStore(),
      touched: () => {},
      redrawElement: async (id) => {
        note("Rebuild element", `Would redraw ${id} from the server on the preview and live site.`);
        return true;
      },
      refreshLoop: async (id, values) => {
        note(
          "Refresh query",
          `Would run loop ${id} again with ${JSON.stringify(values)} on the preview and live site.`
        );
        return true;
      },
      overlays,
      toasts,
      renderOverlay: async (templateId, values) => {
        const template = message.overlays[templateId];
        if (!template) {
          throw new FlowError(
            "no-template",
            "The template is not published or has no conditions that hold."
          );
        }
        return overlayPart(templateId, template, render, live.context(), values);
      }
    });
    let error: string | null = null;
    try {
      await runFlow(message.nodes, {
        baseScope: () => live.scope(),
        handlers,
        blocks: message.blocks,
        elementId: message.elementId,
        log,
        signal: own.signal
      });
    } catch (caught) {
      error = errorValue(caught).message;
    }
    if (controller === own) post({ type: "test-done", runId: message.runId, error });
  }

  return { run, stop };
}
