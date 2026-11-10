"use client";

import { BASE_CSS, PageRenderer, getElementDefinition } from "@nextomic/renderer";
import { previewTimeline, type PreviewHandle } from "@nextomic/runtime";
import { findNode } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { createCanvasTester, type StateOverride } from "./canvas-test";
import {
  hostMessageSchema,
  type CanvasMessage,
  type HostMessage,
  type RenderMessage
} from "./protocol";

type AnimationCommand = Extract<HostMessage, { type: "anim-load" | "anim-control" | "anim-seek" }>;

// Runs INSIDE the sandboxed iframe. It renders whatever tree the editor posts, reports clicks,
// forwards wheel and middle-button gestures, and hit-tests drags for the editor.

const EDITOR_CSS = `${BASE_CSS}
html[data-nxt-mode="dark"] body{background:#0b0b0c;color:#f2f2f2}
[data-nid]{box-sizing:border-box}
[data-nid]:empty:not(img){min-height:48px;outline:1px dashed rgba(128,128,128,.55);outline-offset:-1px}
[data-nid]:hover{outline:1px solid rgba(0,111,238,.55);outline-offset:-1px}
[data-nid][data-nxt-selected]{outline:2px solid #006fee!important;outline-offset:-2px}
html[data-nxt-hide-selection] [data-nid][data-nxt-selected]{outline:none!important}
[data-nid="layout-header"],[data-nid="layout-footer"]{pointer-events:none}
#nxt-pick{position:fixed;display:none;pointer-events:none;z-index:2147483646;box-shadow:0 0 0 200vmax rgba(255,105,180,.28);outline:2px solid #ff4fa3;outline-offset:-2px}
html[data-nxt-picking],html[data-nxt-picking] *{cursor:crosshair!important}
#nxt-drop{position:fixed;display:none;pointer-events:none;z-index:2147483647;background:rgba(0,111,238,.9)}
#nxt-drop[data-zone="inside"]{background:rgba(0,111,238,.12);outline:2px solid #006fee;outline-offset:-2px}
`;

/**
 * Sends the IDs whose conditions failed everywhere they render (inside a loop, in every row) once
 * the render is committed.
 */
function ReportFailed({
  failed,
  held
}: {
  failed: ReadonlySet<string>;
  held: ReadonlySet<string>;
}) {
  useEffect(() => {
    postToHost({ type: "conditions-failed", ids: [...failed].filter((id) => !held.has(id)) });
  });
  return null;
}

function postToHost(message: CanvasMessage): void {
  window.parent.postMessage(message, "*");
}

function zoneFor(y: number, rect: DOMRect, canNest: boolean): "before" | "inside" | "after" {
  const ratio = (y - rect.top) / Math.max(rect.height, 1);
  if (canNest) return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
  return ratio < 0.5 ? "before" : "after";
}

export function CanvasDocument() {
  const [payload, setPayload] = useState<RenderMessage | null>(null);
  const payloadRef = useRef<RenderMessage | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const loadSeq = useRef(0);
  const pickRef = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);
  // App and page state changed by a flow editor Test (cleared when the test ends).
  const [override, setOverride] = useState<StateOverride | null>(null);

  payloadRef.current = payload;

  useEffect(() => {
    function hideMarker() {
      if (markerRef.current) markerRef.current.style.display = "none";
    }

    function probe(x: number, y: number) {
      const marker = markerRef.current;
      const current = payloadRef.current;
      if (!marker || !current) return;
      const rootId = current.tree.id;
      const hit = document.elementFromPoint(x, y);
      const el = hit instanceof Element ? hit.closest("[data-nid]") : null;
      const id = el?.getAttribute("data-nid") ?? rootId;
      const target = el ?? document.querySelector(`[data-nid="${CSS.escape(rootId)}"]`);
      if (!target) return;
      const node = findNode(current.tree, id)?.node;
      const canNest = node ? (getElementDefinition(node.type)?.canHaveChildren ?? false) : false;
      const rect = target.getBoundingClientRect();
      // The root only accepts "inside"; there is nothing around it to insert beside.
      const zone = id === rootId ? "inside" : zoneFor(y, rect, canNest);
      marker.dataset.zone = zone;
      marker.style.display = "block";
      marker.style.left = `${rect.left}px`;
      marker.style.width = `${rect.width}px`;
      if (zone === "inside") {
        marker.style.top = `${rect.top}px`;
        marker.style.height = `${rect.height}px`;
      } else {
        marker.style.top = `${(zone === "before" ? rect.top : rect.bottom) - 1}px`;
        marker.style.height = "3px";
      }
      postToHost({ type: "probe-result", id, zone });
    }

    function reportAnimation(handle: PreviewHandle, playing: boolean) {
      postToHost({
        type: "anim-state",
        time: handle.time(),
        duration: handle.duration(),
        playing
      });
    }

    function clearPreview() {
      loadSeq.current += 1;
      previewRef.current?.destroy();
      previewRef.current = null;
    }

    function onAnimation(message: AnimationCommand) {
      if (message.type === "anim-load") {
        clearPreview();
        const seq = loadSeq.current;
        void previewTimeline(message.timeline).then((handle) => {
          if (seq !== loadSeq.current) {
            handle.destroy();
            return;
          }
          previewRef.current = handle;
          handle.onUpdate((_, playing) => reportAnimation(handle, playing));
          reportAnimation(handle, false);
        });
        return;
      }
      if (message.type === "anim-control" && message.command === "clear") {
        clearPreview();
        postToHost({ type: "anim-state", time: 0, duration: 0, playing: false });
        return;
      }
      const handle = previewRef.current;
      if (!handle) return;
      if (message.type === "anim-seek") {
        handle.seek(message.time);
        reportAnimation(handle, false);
      } else if (message.command === "play") {
        handle.play();
        reportAnimation(handle, true);
      } else if (message.command === "pause") {
        handle.pause();
        reportAnimation(handle, false);
      } else if (message.command === "stop") {
        handle.stop();
        reportAnimation(handle, false);
      }
    }

    const tester = createCanvasTester({
      current: () => payloadRef.current,
      setOverride,
      post: postToHost
    });

    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const parsed = hostMessageSchema.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === "render") setPayload(message);
      else if (message.type === "test-run") void tester.run(message);
      else if (message.type === "test-stop") tester.stop();
      else if (message.type === "pick") setPicking(message.on);
      else if (
        message.type === "anim-load" ||
        message.type === "anim-control" ||
        message.type === "anim-seek"
      )
        onAnimation(message);
      else if (message.type === "probe") probe(message.x, message.y);
      else if (message.type === "measure") {
        const el = document.querySelector(`[data-nid="${CSS.escape(message.id)}"]`);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        postToHost({
          type: "measure-result",
          id: message.id,
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height
        });
      } else hideMarker();
    }
    window.addEventListener("message", onMessage);
    postToHost({ type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      tester.stop();
      clearPreview();
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    const root = document.documentElement;
    root.setAttribute("data-nxt-mode", payload.mode);
    if (payload.theme) root.setAttribute("data-nxt-theme", payload.theme.slug);
    else root.removeAttribute("data-nxt-theme");
  }, [payload]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      event.preventDefault();
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("[data-nid]") : null;
      const id = target?.getAttribute("data-nid") ?? null;
      postToHost({ type: "select", id: id === payloadRef.current?.tree.id ? null : id });
    }
    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
      const target = event.target instanceof Element ? event.target.closest("[data-nid]") : null;
      const id = target?.getAttribute("data-nid");
      if (!id || id === payloadRef.current?.tree.id) return;
      postToHost({ type: "context", id, clientX: event.clientX, clientY: event.clientY });
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, []);

  // Wheel zooms the canvas and the middle button drags it. Both are forwarded to the host.
  useEffect(() => {
    let panning = false;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      postToHost({
        type: "wheel",
        clientX: event.clientX,
        clientY: event.clientY,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        shift: event.shiftKey
      });
    }
    function onDown(event: MouseEvent) {
      if (event.button !== 1) return;
      event.preventDefault();
      panning = true;
      postToHost({ type: "pan", phase: "start", screenX: event.screenX, screenY: event.screenY });
    }
    function onMove(event: MouseEvent) {
      if (!panning) return;
      postToHost({ type: "pan", phase: "move", screenX: event.screenX, screenY: event.screenY });
    }
    function onUp(event: MouseEvent) {
      if (!panning || event.button !== 1) return;
      panning = false;
      postToHost({ type: "pan", phase: "end", screenX: event.screenX, screenY: event.screenY });
    }
    function stopAuxClick(event: MouseEvent) {
      if (event.button === 1) event.preventDefault();
    }
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
    document.addEventListener("auxclick", stopAuxClick, true);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
      document.removeEventListener("auxclick", stopAuxClick, true);
    };
  }, []);

  // Element picking: everything is covered by a light pink fill except the element under the pointer.
  useEffect(() => {
    const cover = pickRef.current;
    if (!picking || !cover) return;
    document.documentElement.setAttribute("data-nxt-picking", "");
    function show(rect: { left: number; top: number; width: number; height: number }) {
      if (!cover) return;
      cover.style.display = "block";
      cover.style.left = `${rect.left}px`;
      cover.style.top = `${rect.top}px`;
      cover.style.width = `${rect.width}px`;
      cover.style.height = `${rect.height}px`;
    }
    function onMove(event: MouseEvent) {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const el = hit instanceof Element ? hit.closest("[data-nid]") : null;
      show(
        el
          ? el.getBoundingClientRect()
          : { left: event.clientX, top: event.clientY, width: 0, height: 0 }
      );
    }
    function onLeave() {
      show({ left: 0, top: 0, width: 0, height: 0 });
    }
    show({ left: 0, top: 0, width: 0, height: 0 });
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.documentElement.removeAttribute("data-nxt-picking");
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseleave", onLeave);
      cover.style.display = "none";
    };
  }, [picking]);

  // Report the document height so the host can size the frame to the page.
  const hasPayload = payload !== null;
  useEffect(() => {
    if (!hasPayload) return;
    let last = -1;
    const report = () => {
      const height = Math.ceil(document.body.getBoundingClientRect().height);
      if (height !== last) {
        last = height;
        postToHost({ type: "size", height });
      }
    };
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    report();
    return () => observer.disconnect();
  }, [hasPayload]);

  useEffect(() => {
    document
      .querySelectorAll("[data-nxt-selected]")
      .forEach((el) => el.removeAttribute("data-nxt-selected"));
    document.documentElement.toggleAttribute("data-nxt-hide-selection", !!payload?.hideSelection);
    if (!payload?.selectedId) return;
    const el = document.querySelector(`[data-nid="${CSS.escape(payload.selectedId)}"]`);
    el?.setAttribute("data-nxt-selected", "");
  });

  // Elements whose conditions fail in this render; reported after commit for the Navigator.
  const failed = new Set<string>();
  const held = new Set<string>();
  if (!payload) return null;
  return (
    <>
      <style>{EDITOR_CSS}</style>
      <PageRenderer
        tree={payload.tree}
        breakpoints={payload.breakpoints}
        classes={payload.classes}
        variables={payload.variables}
        fonts={payload.fonts}
        fontBase={payload.fontBase}
        theme={payload.theme}
        customCss={payload.customCss}
        dynamic={override ? { ...payload.dynamic, ...override } : payload.dynamic}
        loopRows={payload.loopRows}
        loopPlaceholder
        visibilityPreview={payload.visibilityPreview}
        conditionsFailed={failed}
        conditionsHeld={held}
      />
      <ReportFailed failed={failed} held={held} />
      <div id="nxt-drop" ref={markerRef} />
      <div id="nxt-pick" ref={pickRef} />
    </>
  );
}
