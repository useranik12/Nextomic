import { toText } from "@nextomic/schema";
import { FlowError, numberParam, type ActionHandler, type RunLogEntry } from "./engine";
import type { LiveState, StateUpdate } from "./live-state";
import type { RuntimePayload } from "./payload";

// Browser actions available in Phase 5b. Every other action reports "does not run yet" until its
// phase (docs/phases.md 5c to 5e).

export interface HandlerDeps {
  payload: RuntimePayload;
  state: LiveState;
  /** Renders and shows the toast template with these values. */
  toast: (
    values: { title: string; message: string; type: string },
    position: string,
    durationMs: number
  ) => Promise<void>;
  /** Redraws every element that reads state, and every slot. */
  rebuild: () => Promise<void>;
  /** A page URL of this site (live or preview). */
  hrefFor: (route: string, query: URLSearchParams) => string;
  log?: (entry: RunLogEntry) => void;
}

const rowsOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

const updatesOf = (value: unknown): StateUpdate[] =>
  rowsOf(value).map((row) => ({
    variable: toText(row.variable),
    operation: toText(row.operation) || "set",
    value: row.value
  }));

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new FlowError("aborted", "The run was stopped."));
    });
  });

function query(pairs: unknown): URLSearchParams {
  const out = new URLSearchParams();
  for (const row of rowsOf(pairs)) {
    const key = toText(row.name);
    if (key) out.append(key, toText(row.value));
  }
  return out;
}

export function starterHandlers(deps: HandlerDeps): Record<string, ActionHandler> {
  return {
    "debug.log": (p, ctx) => {
      // Debug Log writes in preview and Test runs only, never on the live site.
      if (deps.payload.mode === "live") return;
      deps.log?.({ nodeId: ctx.node.id, label: "Debug", status: "ok", ms: 0, output: p.message });
      const level = toText(p.level);
      // Debug Log exists to write to the browser console; preview and Test runs only.
      // eslint-disable-next-line no-console
      (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(
        p.message
      );
    },
    wait: (p, ctx) => sleep(Math.max(0, numberParam(p.durationMs, 0)), ctx.signal),
    toast: async (p) => {
      if (!deps.payload.hasToast) {
        throw new FlowError("no-toast-template", "Publish a toast template to show toasts.");
      }
      await deps.toast(
        { title: toText(p.title), message: toText(p.message), type: toText(p.type) || "default" },
        toText(p.position),
        Math.min(60_000, Math.max(1000, numberParam(p.durationMs, 4000)))
      );
    },
    "state.updateApp": (p) => deps.state.update("app", updatesOf(p.updates)),
    "state.updatePage": (p) => deps.state.update("state", updatesOf(p.updates)),
    "page.rebuild": () => deps.rebuild(),
    "text.set": (p, ctx) => {
      const id = toText(p.element) || ctx.elementId;
      if (!id) throw new FlowError("no-element", "Choose the element to change.");
      const els = document.querySelectorAll(`[data-nid="${CSS.escape(id)}"]`);
      if (els.length === 0) throw new FlowError("no-element", "The element is not on the page.");
      els.forEach((el) => (el.textContent = toText(p.text)));
    },
    navigate: (p) => {
      const route = deps.payload.routes[toText(p.page)];
      if (!route) throw new FlowError("no-page", "The page no longer exists.");
      const params = query(p.routeParams);
      for (const [k, v] of query(p.query)) params.append(k, v);
      const href = deps.hrefFor(route, params);
      if (toText(p.replace) === "true") window.location.replace(href);
      else window.location.assign(href);
    },
    navigateBack: () => window.history.back(),
    "page.reload": (p) => {
      window.setTimeout(() => window.location.reload(), Math.max(0, numberParam(p.delay, 0)));
    }
  };
}
