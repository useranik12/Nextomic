import {
  SERVER_ACTION_TYPES,
  actionSlots,
  getAction,
  operandValue,
  toText,
  type ThemeChoice
} from "@nextomic/schema";
import { browserActionHandlers } from "./browser-actions";
import { pickerHandlers, pickValue } from "./pickers";
import { themeHandlers } from "./theme-actions";
import { fileHandlers } from "./file-handlers";
import { chooseFiles, FileStore, type UploadedFile } from "./files";
import { FlowError, numberParam, type ActionHandler, type RunLogEntry } from "./engine";
import { htmlPropsHandlers, type ElementEditStore } from "./html-props";
import type { LiveState, StateUpdate } from "./live-state";
import type { OverlayLayer, ShowOverlayOptions } from "./overlays";
import type { OverlayPart, RuntimePayload } from "./payload";
import type { ToastStack } from "./toasts";

// Browser actions that run today (5b and 5c). Every other action reports "does not run yet" until
// its phase (docs/phases.md 5d and 5e).

export interface Navigation {
  open: (href: string, replace: boolean) => void;
  /** A link in a new tab (without access to this page). */
  openTab: (href: string) => void;
  back: () => void;
  reload: () => void;
}

/** The browser's own navigation, for built pages. */
export const browserNavigation: Navigation = {
  open: (href, replace) => (replace ? window.location.replace(href) : window.location.assign(href)),
  openTab: (href) => void window.open(href, "_blank", "noopener,noreferrer"),
  back: () => window.history.back(),
  reload: () => window.location.reload()
};

export interface HandlerDeps {
  payload: RuntimePayload;
  state: LiveState;
  /** Renders a modal or bottom sheet template with these parameter values. */
  renderOverlay: (templateId: string, params: Record<string, string>) => Promise<OverlayPart>;
  overlays: OverlayLayer;
  toasts: ToastStack;
  /** Redraws every element that reads state, and every slot. */
  rebuild: () => Promise<void>;
  /** Changes made by class, ID and attribute actions (sent with fragment requests). */
  edits: ElementEditStore;
  /** Tells the runtime these elements changed ("el.<id>"), so elements that check them redraw. */
  touched: (names: string[]) => void;
  /** Redraws one element from the server; false when it cannot be redrawn alone. */
  redrawElement: (id: string) => Promise<boolean>;
  /**
   * Runs a query loop again with the saved query of the Refresh Query node `nodeId` and its filled
   * slot values (null: the loop's own query); false when it cannot be redrawn alone.
   */
  refreshLoop: (id: string, nodeId: string, values: string[] | null) => Promise<boolean>;
  /**
   * Runs the saved server action `nodeId` (Supabase rows, Supabase RPC, API Data call) on the
   * server with the filled values of its {{ tag }} fields; returns what it answered.
   */
  runServer: (nodeId: string, values: string[]) => Promise<unknown>;
  /** Stores one picked file with the saved Pick File(s) / Upload File node `nodeId`. */
  uploadFile: (nodeId: string, values: string[], file: File) => Promise<UploadedFile>;
  /** Replaces the browser's file chooser (the editor's Test reports instead). */
  chooseFiles?: typeof chooseFiles;
  /** Replaces the browser's date, time and color pickers (the editor's Test reports instead). */
  pick?: typeof pickValue;
  /** Replaces the theme switch (the editor's Test reports instead). */
  setTheme?: (choice: ThemeChoice) => void;
  /** A page URL of this site (live or preview). */
  hrefFor: (route: string, query: URLSearchParams) => string;
  /** Leaves or reloads the page; the editor's Test only reports where it would go. */
  navigation: Navigation;
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

const optionalNumber = (value: unknown): number | undefined =>
  value === "" || value === undefined || value === null ? undefined : numberParam(value, 0);
const optionalBoolean = (value: unknown): boolean | undefined => {
  const text = toText(value);
  return text === "" ? undefined : text === "true";
};

function overlayOptions(p: Record<string, unknown>): ShowOverlayOptions {
  return {
    overlayDisabled: optionalBoolean(p.overlayDisabled),
    overlayColor: toText(p.overlayColor) || undefined,
    overlayOpacity: optionalNumber(p.overlayOpacity),
    noOverlayDismiss: toText(p.noOverlayDismiss) === "true",
    noDrag: toText(p.noDrag) === "true"
  };
}

export function starterHandlers(deps: HandlerDeps): Record<string, ActionHandler> {
  const showOverlay = async (type: OverlayPart["type"], p: Record<string, unknown>) => {
    const templateId = toText(p.template);
    if (!templateId) throw new FlowError("no-template", "Choose the template to show.");
    const part = await deps.renderOverlay(templateId, Object.fromEntries(query(p.params)));
    if (part.type !== type)
      throw new FlowError("wrong-template", "That template is the wrong type.");
    deps.overlays.show(part, overlayOptions(p));
  };
  const closeOverlay = (type: OverlayPart["type"], p: Record<string, unknown>) =>
    deps.overlays.close(type, toText(p.template) || undefined);
  const toggleOverlay = async (type: OverlayPart["type"], p: Record<string, unknown>) => {
    const templateId = toText(p.template);
    if (templateId && deps.overlays.isOpen(templateId)) deps.overlays.close(type, templateId);
    else await showOverlay(type, p);
  };
  const serverHandlers: Record<string, ActionHandler> = Object.fromEntries(
    SERVER_ACTION_TYPES.map((type) => [
      type,
      (_params: Record<string, unknown>, ctx: Parameters<ActionHandler>[1]) => {
        const def = getAction(type);
        if (!def) throw new FlowError("unknown-action", `Unknown action "${type}".`);
        // The server takes the action itself from the saved flow; only tag values leave the page.
        const values = actionSlots(def, ctx.node.params).map((slot) =>
          toText(operandValue(slot, ctx.scope))
        );
        return deps.runServer(ctx.node.id, values);
      }
    ])
  );
  const files = new FileStore();
  return {
    ...serverHandlers,
    ...fileHandlers({
      store: files,
      choose: deps.chooseFiles ?? chooseFiles,
      upload: deps.uploadFile,
      runServer: deps.runServer
    }),
    ...pickerHandlers({ pick: deps.pick ?? pickValue }),
    ...themeHandlers(deps.payload.themes, deps.setTheme),
    ...htmlPropsHandlers({ edits: deps.edits, touched: deps.touched }),
    ...browserActionHandlers(deps.navigation),
    "element.rebuild": async (p) => {
      const id = toText(p.element);
      if (!id) throw new FlowError("no-element", "Choose the element to rebuild.");
      if (!(await deps.redrawElement(id)))
        throw new FlowError(
          "not-redrawable",
          "This element is not on the page, or it is inside a query loop (rebuild the loop instead)."
        );
    },
    "query.refresh": async (p, ctx) => {
      const id = toText(p.query);
      if (!id) throw new FlowError("no-query", "Choose the query loop to refresh.");
      const values = Array.isArray(p.override) ? p.override.map((v) => toText(v)) : null;
      // The server refuses tags in values; refusing here keeps later redraws working.
      if (values?.some((v) => v.includes("{{")))
        throw new FlowError("bad-value", "A query value cannot hold {{ }}.");
      if (!(await deps.refreshLoop(id, ctx.node.id, values)))
        throw new FlowError(
          "no-query",
          "That query loop is not on this page, or it is inside another loop."
        );
    },
    "modal.show": (p) => showOverlay("modal", p),
    "modal.close": (p) => closeOverlay("modal", p),
    "modal.toggle": (p) => toggleOverlay("modal", p),
    "bottomSheet.show": (p) => showOverlay("bottom-sheet", p),
    "bottomSheet.dismiss": (p) => closeOverlay("bottom-sheet", p),
    "toast.dismiss": (p) => deps.toasts.dismiss(toText(p.which) === "all" ? "all" : "current"),
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
    toast: (p, ctx) => {
      if (toText(p.title).trim() === "") {
        throw new FlowError("no-title", "Write the title of the toast.");
      }
      const showButton = toText(p.showButton) === "true";
      deps.toasts.show({
        title: toText(p.title),
        message: toText(p.message) || undefined,
        buttonText: showButton ? toText(p.buttonText) || undefined : undefined,
        onButton: showButton
          ? () => {
              ctx.runSlot("buttonAction").catch((e: unknown) =>
                deps.log?.({
                  nodeId: ctx.node.id,
                  label: "Toast button",
                  status: "error",
                  ms: 0,
                  error: e instanceof Error ? e.message : String(e)
                })
              );
            }
          : undefined,
        buttonColor: toText(p.buttonColor) || undefined,
        buttonTextColor: toText(p.buttonTextColor) || undefined,
        backgroundColor: toText(p.backgroundColor) || undefined,
        titleColor: toText(p.titleColor) || undefined,
        messageColor: toText(p.messageColor) || undefined,
        borderStyle: toText(p.borderStyle) || undefined,
        borderWidthPx: optionalNumber(p.borderWidth),
        borderColor: toText(p.borderColor) || undefined,
        borderRadiusPx: optionalNumber(p.borderRadius),
        hideAfterMs: numberParam(p.hideAfterMs, 5000),
        hidePrevious: toText(p.hidePrevious) === "true"
      });
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
      const params = query(p.params);
      for (const [k, v] of query(p.query)) params.append(k, v);
      const href = deps.hrefFor(route, params);
      deps.navigation.open(href, toText(p.replace) === "true");
      return href;
    },
    navigateBack: () => deps.navigation.back(),
    "page.reload": (p) => {
      window.setTimeout(() => deps.navigation.reload(), Math.max(0, numberParam(p.delay, 0)));
    }
  };
}
