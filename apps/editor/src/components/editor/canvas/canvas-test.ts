import { pageCss, renderNode } from "@nextomic/renderer";
import {
  errorValue,
  LiveState,
  runFlow,
  showToastHtml,
  starterHandlers,
  type RunLogEntry,
  type RuntimePayload
} from "@nextomic/runtime";
import { createTokenResolver, type DynamicContext } from "@nextomic/schema";
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

/** The toast template's content as HTML and CSS, rendered here like the server would. */
function toastMarkup(run: TestRun, render: RenderMessage, dynamic: DynamicContext) {
  const template = run.toast;
  if (!template) return null;
  const resolveToken = createTokenResolver(dynamic);
  const options = {
    breakpoints: render.breakpoints,
    classes: render.classes,
    dynamic,
    resolveToken,
    tree: template
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      createElement(Fragment, null, ...template.children.map((child) => renderNode(child, options)))
    )
  );
  const html = host.innerHTML;
  root.unmount();
  return { html, css: pageCss(template, render.breakpoints, {}, resolveToken) };
}

export function createCanvasTester({ current, setOverride, post }: TesterDeps) {
  let controller: AbortController | null = null;

  function stop() {
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
      routes: message.routes,
      hasToast: message.toast !== null
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
        back: () => note("Navigation", "Would go back; Test stays in the editor."),
        reload: () => note("Navigation", "Would reload the page; Test stays in the editor.")
      },
      // The canvas re-renders from state on its own.
      rebuild: async () => {},
      toast: async (values, position, durationMs) => {
        const markup = toastMarkup(message, render, { ...live.context(), toast: values });
        if (markup) showToastHtml(markup.html, markup.css, position, durationMs);
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
