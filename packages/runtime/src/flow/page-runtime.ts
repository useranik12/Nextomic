import type { FlowNode, Params, TriggerFlow } from "@nextomic/schema";
import { restorePersisted, type PersistEnv } from "../persisted-state";
import { outermost, swapParts } from "./dom";
import { ElementEditStore } from "./html-props";
import { FlowError, runFlow, type ActionHandler, type RunLogEntry } from "./engine";
import { browserNavigation, starterHandlers } from "./handlers";
import { LiveState } from "./live-state";
import { createOverlayLayer } from "./overlays";
import { createToastStack } from "./toasts";
import type { FragmentRequest, FragmentResponse, RuntimePayload } from "./payload";

// The action runtime of a built page (docs/dynamic-data-and-actions.md section 8): binds the
// page's triggers, runs their flows, keeps app and page state, and redraws the elements that read
// changed state through server fragments.

export interface RuntimeOptions {
  fetchFragments: (request: FragmentRequest) => Promise<FragmentResponse>;
  hrefFor: (route: string, query: URLSearchParams) => string;
  /** Runs a saved server action; resolves to what it answered, rejects with a readable message. */
  runServerAction: (request: { node: string; values: string[] }) => Promise<unknown>;
  persist: PersistEnv | null;
  /** A flow failed with no Try/Catch around the failing node. */
  onError?: (message: string) => void;
  log?: (entry: RunLogEntry) => void;
}

export interface ActionRuntime {
  /** Runs nodes as if a trigger of `nodeId` fired (the editor's Test). */
  run: (
    nodeId: string | null,
    nodes: readonly FlowNode[],
    log?: (e: RunLogEntry) => void
  ) => Promise<void>;
  stop: () => void;
}

const num = (settings: Params, key: string, fallback: number) => {
  const n = Number(typeof settings[key] === "string" ? settings[key] : "");
  return Number.isFinite(n) && settings[key] !== "" ? n : fallback;
};
const text = (settings: Params, key: string, fallback = "") =>
  typeof settings[key] === "string" && settings[key] !== "" ? settings[key] : fallback;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** "Ctrl+k" style key specs. */
function keyMatches(spec: string, e: KeyboardEvent): boolean {
  const parts = spec.split("+").map((p) => p.trim().toLowerCase());
  const key = parts.pop() ?? "";
  const mods = new Set(parts);
  return (
    e.key.toLowerCase() === key &&
    e.ctrlKey === mods.has("ctrl") &&
    e.altKey === mods.has("alt") &&
    e.shiftKey === mods.has("shift") &&
    e.metaKey === (mods.has("meta") || mods.has("cmd"))
  );
}

export function startActionRuntime(
  payload: RuntimePayload,
  options: RuntimeOptions
): ActionRuntime {
  const stops: (() => void)[] = [];
  const listen = <K extends keyof DocumentEventMap>(
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
    capture = false
  ) => {
    document.addEventListener(type, fn, capture);
    stops.push(() => document.removeEventListener(type, fn, capture));
  };
  const roots = new Set(payload.rootIds);
  const flowOf = (nodeId: string, trigger: string): TriggerFlow | undefined =>
    payload.flows[nodeId]?.find((f) => f.trigger === trigger && !f.disabled && f.nodes.length > 0);

  // --- state and redraw -------------------------------------------------------------------
  const edits = new ElementEditStore();
  /** The last Refresh Query of each loop; later redraws of the loop run it the same way. */
  const refreshes: Record<string, { node: string; values: string[] | null }> = {};
  let pending = new Set<string>();
  let scheduled = false;
  /** Redraws the elements from the server; returns the ids that were redrawn. */
  const redraw = async (ids: string[]): Promise<string[]> => {
    const wanted = outermost(ids, document);
    if (wanted.length === 0) return [];
    const { app, state } = live.context();
    const response = await options.fetchFragments({
      ids: wanted,
      app,
      state,
      edits: edits.snapshot(),
      refreshes
    });
    const inserted = swapParts(response.parts);
    for (const el of inserted) bindInserted(el);
    return response.parts.map((part) => part.id);
  };
  const onChange = (names: string[]) => {
    for (const [id, refs] of Object.entries(payload.deps)) {
      if (refs.some((r) => names.includes(r))) pending.add(id);
    }
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const ids = [...pending];
      pending = new Set();
      redraw(ids).catch((e: unknown) => options.onError?.(String(e)));
    });
  };
  const restored = options.persist ? restorePersisted(payload.appState, options.persist) : {};
  const live = new LiveState(payload, restored, options.persist, onChange);

  const overlays = createOverlayLayer((content) => bindInserted(content));
  const toasts = createToastStack();
  stops.push(overlays.destroy, toasts.destroy);

  const handlers: Record<string, ActionHandler> = starterHandlers({
    payload,
    state: live,
    log: options.log,
    hrefFor: options.hrefFor,
    navigation: browserNavigation,
    edits,
    touched: (names) => onChange(names),
    redrawElement: async (id) => (await redraw([id])).includes(id),
    runServer: async (nodeId, values) => {
      try {
        return await options.runServerAction({ node: nodeId, values });
      } catch (error) {
        throw new FlowError(
          "server-action",
          error instanceof Error ? error.message : String(error)
        );
      }
    },
    refreshLoop: async (id, nodeId, values) => {
      refreshes[id] = { node: nodeId, values };
      return (await redraw([id])).includes(id);
    },
    rebuild: async () => {
      const slots = [...document.querySelectorAll("template[data-nx-slot]")].map(
        (t) => t.getAttribute("data-nx-slot") ?? ""
      );
      await redraw([...Object.keys(payload.deps), ...slots]);
    },
    overlays,
    toasts,
    renderOverlay: async (templateId, params) => {
      const { app, state } = live.context();
      const response = await options.fetchFragments({
        app,
        state,
        overlay: { templateId, params }
      });
      if (!response.overlay) throw new FlowError("no-template", "The template cannot be shown.");
      return response.overlay;
    }
  });

  const run = (nodeId: string | null, nodes: readonly FlowNode[], log = options.log) =>
    runFlow(nodes, {
      baseScope: () => live.scope(),
      handlers,
      blocks: payload.blocks,
      elementId: nodeId && !roots.has(nodeId) ? nodeId : null,
      log
    });
  const fire = (nodeId: string, flow: TriggerFlow) => {
    run(nodeId, flow.nodes).catch((e: unknown) =>
      options.onError?.(e instanceof Error ? e.message : String(e))
    );
  };
  /** The nearest element (from the event target up) with a flow for this trigger. */
  const nearest = (target: EventTarget | null, trigger: string) => {
    let el = target instanceof Element ? target.closest("[data-nid]") : null;
    while (el) {
      const id = el.getAttribute("data-nid") ?? "";
      const flow = flowOf(id, trigger);
      if (flow) return { el, id, flow };
      el = el.parentElement?.closest("[data-nid]") ?? null;
    }
    return null;
  };

  // --- element triggers -------------------------------------------------------------------
  const simple: [keyof DocumentEventMap, string][] = [
    ["click", "click"],
    ["dblclick", "doubleClick"]
  ];
  for (const [type, trigger] of simple) {
    listen(type, (e) => {
      const hit = nearest(e.target, trigger);
      if (hit) fire(hit.id, hit.flow);
    });
  }
  listen("contextmenu", (e) => {
    const hit = nearest(e.target, "secondaryClick");
    if (!hit) return;
    e.preventDefault();
    fire(hit.id, hit.flow);
  });
  let hold = 0;
  listen("pointerdown", (e) => {
    window.clearTimeout(hold);
    const hit = e.button === 0 ? nearest(e.target, "clickHold") : null;
    if (hit)
      hold = window.setTimeout(() => fire(hit.id, hit.flow), num(hit.flow.settings, "holdMs", 500));
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
    listen(type, () => window.clearTimeout(hold));
  }
  const crossing = (type: "mouseover" | "mouseout" | "focusin" | "focusout", trigger: string) =>
    listen(type, (e) => {
      const hit = nearest(e.target, trigger);
      const related = (e as MouseEvent | FocusEvent).relatedTarget;
      if (hit && !(related instanceof Node && hit.el.contains(related))) fire(hit.id, hit.flow);
    });
  crossing("mouseover", "hoverStart");
  crossing("mouseout", "hoverEnd");
  crossing("focusin", "focus");
  crossing("focusout", "blur");
  for (const [type, trigger] of [
    ["load", "image.loaded"],
    ["error", "image.loadError"]
  ] as const) {
    listen(
      type,
      (e) => {
        const el = e.target;
        if (!(el instanceof HTMLImageElement)) return;
        const id = el.getAttribute("data-nid") ?? "";
        const flow = flowOf(id, trigger);
        if (flow) fire(id, flow);
      },
      true
    );
  }

  // --- lifecycle and observer triggers ----------------------------------------------------
  const observers: (IntersectionObserver | ResizeObserver)[] = [];
  stops.push(() => observers.forEach((o) => o.disconnect()));
  const watchViewport = (el: Element, id: string, trigger: "enterViewport" | "leaveViewport") => {
    const flow = flowOf(id, trigger);
    if (!flow) return;
    const amount = Math.min(100, Math.max(0, num(flow.settings, "amount", 0))) / 100;
    const once = text(flow.settings, "repeat", "once") === "once";
    let wasIn = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIn = Boolean(entry?.isIntersecting) && (entry?.intersectionRatio ?? 0) >= amount;
        const fires = trigger === "enterViewport" ? isIn && !wasIn : !isIn && wasIn;
        wasIn = isIn;
        if (!fires) return;
        fire(id, flow);
        if (once) observer.disconnect();
      },
      { rootMargin: text(flow.settings, "margin", "0px"), threshold: [0, amount || 0.0001, 1] }
    );
    observer.observe(el);
    observers.push(observer);
  };
  const watchResize = (el: Element, id: string) => {
    const flow = flowOf(id, "resized");
    if (!flow) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) first = false;
      else fire(id, flow);
    });
    observer.observe(el);
    observers.push(observer);
  };
  /** Load, viewport and resize triggers of an element and everything inside it. */
  function bindInserted(root: Element) {
    const els = [root, ...root.querySelectorAll("[data-nid]")];
    for (const el of els) {
      const id = el.getAttribute("data-nid") ?? "";
      if (!payload.flows[id] || roots.has(id)) continue;
      const load = flowOf(id, "load");
      if (load) fire(id, load);
      watchViewport(el, id, "enterViewport");
      watchViewport(el, id, "leaveViewport");
      watchResize(el, id);
    }
  }
  for (const el of document.querySelectorAll("[data-nid]")) {
    if (el.parentElement?.closest("[data-nid]")) continue;
    bindInserted(el);
  }

  // --- page and template root triggers ----------------------------------------------------
  for (const rootId of roots) {
    const loaded = flowOf(rootId, "load");
    if (loaded) fire(rootId, loaded);
    const key = flowOf(rootId, "keyPress");
    if (key) {
      listen("keydown", (e) => {
        if (!isTyping(e.target) && keyMatches(text(key.settings, "key"), e)) fire(rootId, key);
      });
    }
    const timer = flowOf(rootId, "timer");
    if (timer) {
      const every = Math.max(100, num(timer.settings, "intervalMs", 1000));
      const repeat = text(timer.settings, "repeat", "true") === "true";
      const handle = repeat
        ? window.setInterval(() => fire(rootId, timer), every)
        : window.setTimeout(() => fire(rootId, timer), every);
      stops.push(() => (repeat ? window.clearInterval(handle) : window.clearTimeout(handle)));
    }
    for (const [type, trigger] of [
      ["pagehide", "pageLeave"],
      ["online", "online"],
      ["offline", "offline"]
    ] as const) {
      const flow = flowOf(rootId, trigger);
      if (!flow) continue;
      const fn = () => fire(rootId, flow);
      window.addEventListener(type, fn);
      stops.push(() => window.removeEventListener(type, fn));
    }
  }

  // Persisted values that differ from the server render are redrawn right away.
  const restoredNames = Object.keys(restored)
    .filter((name) => restored[name] !== payload.dynamic.app[name])
    .map((name) => `app.${name}`);
  if (restoredNames.length > 0) onChange(restoredNames);

  return { run, stop: () => stops.splice(0).forEach((stop) => stop()) };
}
