"use client";

import { PageRenderer, getElementDefinition } from "@nextomic/renderer";
import { findNode } from "@nextomic/schema";
import { useEffect, useRef, useState } from "react";
import { hostMessageSchema, type CanvasMessage, type RenderMessage } from "./protocol";

// Runs INSIDE the sandboxed iframe. It renders whatever tree the editor posts, reports clicks,
// forwards wheel and middle-button gestures, and hit-tests drags for the editor.

const EDITOR_CSS = `
html,body{margin:0}
body{display:flow-root;background:#fff;color:#111;font-family:system-ui,sans-serif}
html[data-nxt-mode="dark"] body{background:#0b0b0c;color:#f2f2f2}
[data-nid]{box-sizing:border-box}
[data-nid]:empty:not(img){min-height:48px;outline:1px dashed rgba(128,128,128,.55);outline-offset:-1px}
[data-nid]:hover{outline:1px solid rgba(0,111,238,.55);outline-offset:-1px}
[data-nid][data-nxt-selected]{outline:2px solid #006fee!important;outline-offset:-2px}
#nxt-drop{position:fixed;display:none;pointer-events:none;z-index:2147483647;background:rgba(0,111,238,.9)}
#nxt-drop[data-zone="inside"]{background:rgba(0,111,238,.12);outline:2px solid #006fee;outline-offset:-2px}
`;

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

    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const parsed = hostMessageSchema.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === "render") setPayload(message);
      else if (message.type === "probe") probe(message.x, message.y);
      else hideMarker();
    }
    window.addEventListener("message", onMessage);
    postToHost({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (payload) document.documentElement.setAttribute("data-nxt-mode", payload.mode);
  }, [payload]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      event.preventDefault();
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("[data-nid]") : null;
      const id = target?.getAttribute("data-nid") ?? null;
      postToHost({ type: "select", id: id === payloadRef.current?.tree.id ? null : id });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
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
    if (!payload?.selectedId) return;
    const el = document.querySelector(`[data-nid="${CSS.escape(payload.selectedId)}"]`);
    el?.setAttribute("data-nxt-selected", "");
  });

  if (!payload) return null;
  return (
    <>
      <style>{EDITOR_CSS}</style>
      <PageRenderer
        tree={payload.tree}
        breakpoints={payload.breakpoints}
        classes={payload.classes}
      />
      <div id="nxt-drop" ref={markerRef} />
    </>
  );
}
