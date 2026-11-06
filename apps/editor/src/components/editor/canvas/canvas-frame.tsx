"use client";

import {
  breakpointPreviewWidth,
  buildDynamicContext,
  customCssFor,
  findNode,
  setStyle
} from "@nextomic/schema";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { useDragActive } from "../dnd";
import { useEditorStore } from "../store/editor-store";
import { themeModeFor, useResolvedTheme } from "../store/use-resolved-theme";
import { onAnimationCommand, reportAnimationState } from "./animation-bridge";
import { setCanvasDropTarget } from "./canvas-drop";
import { CanvasToolbar } from "./canvas-toolbar";
import { canvasMessageSchema, type HostMessage } from "./protocol";

const PADDING = 32;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const MIN_HEIGHT = 800;

interface View {
  zoom: number;
  x: number;
  y: number;
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Zoom by `factor` keeping the point (cx, cy), given in viewport pixels, fixed on screen. */
function zoomAround(view: View, cx: number, cy: number, factor: number): View {
  const zoom = clampZoom(view.zoom * factor);
  const ratio = zoom / view.zoom;
  return { zoom, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio };
}

/** Width of a device turned on its side (phones are long, tablets are 4:3). */
function landscapeWidth(width: number): number {
  return width >= 600 ? Math.round((width * 4) / 3) : Math.round((width * 19.5) / 9);
}

function useViewportSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 })
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}

export const CanvasFrame = memo(function CanvasFrame({ mode }: { mode: "light" | "dark" }) {
  const doc = useEditorStore((s) => s.doc);
  const breakpoints = useEditorStore((s) => s.project.breakpoints);
  const classes = useEditorStore((s) => s.project.classes);
  const variables = useEditorStore((s) => s.project.variables);
  const fonts = useEditorStore((s) => s.project.fonts);
  const cssFiles = useEditorStore((s) => s.project.cssFiles);
  const pageId = useEditorStore((s) => s.page?.id ?? null);
  const projectId = useEditorStore((s) => s.projectId);
  const theme = useResolvedTheme();
  const activeId = useEditorStore((s) => s.activeBreakpointId);
  const selectedId = useEditorStore((s) => s.selectedId);
  const hideSelection = useEditorStore((s) => s.hideSelection);
  const stylePreview = useEditorStore((s) => s.stylePreview);
  const activeClass = useEditorStore((s) => s.activeClass);
  const activeState = useEditorStore((s) => s.activeState);
  const select = useEditorStore((s) => s.select);
  const openContextMenu = useEditorStore((s) => s.openContextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const dragActive = useDragActive();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const { ref: viewportRef, size: viewport } = useViewportSize();
  const [view, setView] = useState<View>({ zoom: 1, x: PADDING, y: PADDING });
  const [docHeight, setDocHeight] = useState(0);
  const [rotated, setRotated] = useState(false);
  const [panning, setPanning] = useState(false);
  const adjusted = useRef(false);
  const lastFit = useRef("");
  const pan = useRef<{ x: number; y: number } | null>(null);
  const insideCanvas = useRef(false);

  const active = breakpoints.find((b) => b.id === activeId) ?? breakpoints[0];
  const canRotate = active !== undefined && active.id !== "base";
  const isRotated = rotated && canRotate;
  const portraitWidth = active ? breakpointPreviewWidth(active) : 1440;
  const frameWidth = isRotated ? landscapeWidth(portraitWidth) : portraitWidth;
  const minHeight = isRotated ? portraitWidth : MIN_HEIGHT;
  const frameHeight = Math.max(docHeight, minHeight);

  const viewRef = useRef(view);
  viewRef.current = view;
  const frameRef = useRef({ width: frameWidth, height: frameHeight });
  frameRef.current = { width: frameWidth, height: frameHeight };

  // Fit with an element selected frames that element; the host asks the canvas for its bounds.
  const fitSelected = useCallback(() => {
    if (selectedId && ready)
      iframeRef.current?.contentWindow?.postMessage(
        { type: "measure", id: selectedId } satisfies HostMessage,
        "*"
      );
  }, [selectedId, ready]);

  const fit = useCallback(() => {
    if (viewport.width === 0) return;
    adjusted.current = false;
    const zoom = clampZoom(Math.min(1, (viewport.width - PADDING * 2) / frameWidth));
    setView({ zoom, x: (viewport.width - frameWidth * zoom) / 2, y: PADDING });
  }, [viewport.width, frameWidth]);

  // Fit on first layout, on a breakpoint or rotation change, and on resize until the user moves it.
  useEffect(() => {
    if (viewport.width === 0) return;
    const key = String(frameWidth);
    if (!adjusted.current || lastFit.current !== key) fit();
    lastFit.current = key;
  }, [viewport.width, frameWidth, fit]);

  const zoomBy = useCallback(
    (factor: number) => {
      adjusted.current = true;
      setView((v) => zoomAround(v, viewport.width / 2, viewport.height / 2, factor));
    },
    [viewport.width, viewport.height]
  );

  const wheelZoom = useCallback((cx: number, cy: number, deltaY: number) => {
    adjusted.current = true;
    const delta = Math.max(-200, Math.min(200, deltaY));
    setView((v) => zoomAround(v, cx, cy, Math.exp(-delta * 0.0025)));
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    adjusted.current = true;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);

  const panMove = useCallback(
    (sx: number, sy: number) => {
      const last = pan.current;
      if (!last) return;
      panBy(sx - last.x, sy - last.y);
      pan.current = { x: sx, y: sy };
    },
    [panBy]
  );

  // Messages from the sandboxed canvas.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const parsed = canvasMessageSchema.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      switch (message.type) {
        case "ready":
          setReady(true);
          break;
        case "select":
          closeContextMenu();
          select(message.id);
          break;
        case "context": {
          const v = viewRef.current;
          const rect = viewportRef.current?.getBoundingClientRect();
          if (!rect) break;
          openContextMenu(
            rect.left + v.x + message.clientX * v.zoom,
            rect.top + v.y + message.clientY * v.zoom,
            message.id
          );
          break;
        }
        case "size":
          setDocHeight(message.height);
          break;
        case "wheel": {
          if (message.shift) panBy(-message.deltaX, -message.deltaY);
          else {
            const v = viewRef.current;
            wheelZoom(
              v.x + message.clientX * v.zoom,
              v.y + message.clientY * v.zoom,
              message.deltaY
            );
          }
          break;
        }
        case "pan":
          if (message.phase === "start") {
            pan.current = { x: message.screenX, y: message.screenY };
            setPanning(true);
          } else if (message.phase === "move") panMove(message.screenX, message.screenY);
          else {
            pan.current = null;
            setPanning(false);
          }
          break;
        case "measure-result": {
          const { x, y, width, height } = message;
          const vw = viewportRef.current?.clientWidth ?? 0;
          const vh = viewportRef.current?.clientHeight ?? 0;
          if (vw === 0 || vh === 0) break;
          adjusted.current = true;
          const zoom = clampZoom(
            Math.min(
              (vw - PADDING * 2) / Math.max(width, 1),
              (vh - PADDING * 2) / Math.max(height, 1)
            )
          );
          setView({
            zoom,
            x: (vw - width * zoom) / 2 - x * zoom,
            y: (vh - height * zoom) / 2 - y * zoom
          });
          break;
        }
        case "anim-state":
          reportAnimationState({
            time: message.time,
            duration: message.duration,
            playing: message.playing
          });
          break;
        case "probe-result":
          if (insideCanvas.current)
            setCanvasDropTarget({ id: message.id ?? "", zone: message.zone });
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [select, closeContextMenu, openContextMenu, viewportRef, panBy, panMove, wheelZoom]);

  const send = useCallback((message: HostMessage) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  // Element picking: the canvas dims the page while a picker waits for an element.
  const picking = useEditorStore((s) => s.picker !== null);
  useEffect(() => {
    if (ready) send({ type: "pick", on: picking });
  }, [ready, picking, send]);

  // Commands from the Animations editor go to the canvas that holds the page.
  useEffect(() => onAnimationCommand((command) => ready && send(command)), [ready, send]);

  useEffect(() => {
    if (!ready || !doc) return;
    // A hovered picker option is drawn on a copy, so nothing is saved or added to the history.
    let tree = doc.tree;
    let sentClasses = classes;
    if (stylePreview && selectedId) {
      if (activeClass) {
        const styles = structuredClone(classes[activeClass] ?? { breakpoints: {} });
        setStyle({ styles }, activeId, activeState, stylePreview.property, stylePreview.value);
        sentClasses = { ...classes, [activeClass]: styles };
      } else {
        tree = structuredClone(doc.tree);
        const found = findNode(tree, selectedId);
        if (found)
          setStyle(found.node, activeId, activeState, stylePreview.property, stylePreview.value);
      }
    }
    send({
      type: "render",
      tree,
      breakpoints,
      classes: sentClasses,
      variables,
      fonts,
      fontBase: `/fonts/${projectId}`,
      theme,
      customCss: customCssFor(cssFiles, pageId),
      mode: themeModeFor(theme, mode),
      selectedId,
      hideSelection,
      dynamic: buildDynamicContext({
        page: { name: doc.name, route: doc.route, settings: doc.settings },
        tree: doc.tree,
        mode: "editor",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
  }, [
    ready,
    doc,
    breakpoints,
    classes,
    variables,
    fonts,
    projectId,
    theme,
    cssFiles,
    pageId,
    mode,
    selectedId,
    hideSelection,
    stylePreview,
    activeClass,
    activeState,
    activeId,
    send
  ]);

  // Wheel over the canvas surround zooms around the cursor. Native listener: React's is passive.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (event.shiftKey) {
        panBy(-event.deltaX, -event.deltaY);
        return;
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      wheelZoom(event.clientX - rect.left, event.clientY - rect.top, event.deltaY);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportRef, panBy, wheelZoom]);

  // Middle button held down drags the canvas (pointer capture keeps it going over the iframe).
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // A click on the empty area around the page selects the page (its settings show on the right).
    if (event.button === 0 && event.target === event.currentTarget) {
      select(null);
      return;
    }
    if (event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pan.current = { x: event.screenX, y: event.screenY };
    setPanning(true);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pan.current) panMove(event.screenX, event.screenY);
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1 || !pan.current) return;
    pan.current = null;
    setPanning(false);
  }

  // While an element is dragged, a shield covers the iframe (it would swallow pointer events) and
  // the pointer is hit-tested against the page so the drop lands where the marker shows.
  useEffect(() => {
    if (!dragActive) return;
    let raf = 0;
    function leave() {
      if (!insideCanvas.current) return;
      insideCanvas.current = false;
      setCanvasDropTarget(null);
      send({ type: "probe-clear" });
    }
    function onMove(event: PointerEvent) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const v = viewRef.current;
      const x = (event.clientX - rect.left - v.x) / v.zoom;
      const y = (event.clientY - rect.top - v.y) / v.zoom;
      const frame = frameRef.current;
      const over =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom &&
        x >= 0 &&
        x <= frame.width &&
        y >= 0 &&
        y <= frame.height;
      if (!over) return leave();
      insideCanvas.current = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => send({ type: "probe", x, y }));
    }
    window.addEventListener("pointermove", onMove, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      cancelAnimationFrame(raf);
      leave();
    };
  }, [dragActive, send, viewportRef]);

  return (
    <div
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onAuxClick={(event) => event.preventDefault()}
      className={`relative h-full w-full overflow-hidden bg-content1/40 ${panning ? "cursor-grabbing" : ""}`}
    >
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: "0 0"
        }}
        className="absolute left-0 top-0"
      >
        <iframe
          ref={iframeRef}
          title="Page canvas"
          src="/canvas"
          sandbox="allow-scripts"
          scrolling="no"
          style={{ width: frameWidth, height: frameHeight }}
          className="block rounded-medium border-0 bg-white shadow-lg"
        />
        {dragActive ? <div aria-hidden className="absolute inset-0" /> : null}
      </div>
      <CanvasToolbar
        zoom={view.zoom}
        canRotate={canRotate}
        rotated={isRotated}
        onZoomOut={() => zoomBy(1 / 1.25)}
        onZoomIn={() => zoomBy(1.25)}
        onActualSize={() => zoomBy(1 / viewRef.current.zoom)}
        onFit={selectedId ? fitSelected : fit}
        onRotate={() => setRotated((r) => !r)}
      />
    </div>
  );
});
