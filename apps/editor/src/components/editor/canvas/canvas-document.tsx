"use client";

import { PageRenderer } from "@nextomic/renderer";
import { useEffect, useState } from "react";
import { hostMessageSchema, type HostMessage } from "./protocol";

// Runs INSIDE the sandboxed iframe. It renders whatever tree the editor posts and reports clicks.

const EDITOR_CSS = `
html,body{margin:0;min-height:100%}
body{background:#fff;color:#111;font-family:system-ui,sans-serif}
html[data-nxt-mode="dark"] body{background:#0b0b0c;color:#f2f2f2}
[data-nid]{box-sizing:border-box}
[data-nid]:empty:not(img){min-height:48px;outline:1px dashed rgba(128,128,128,.55);outline-offset:-1px}
[data-nid]:hover{outline:1px solid rgba(0,111,238,.55);outline-offset:-1px}
[data-nid][data-nxt-selected]{outline:2px solid #006fee!important;outline-offset:-2px}
`;

function postToHost(message: unknown): void {
  window.parent.postMessage(message, "*");
}

export function CanvasDocument() {
  const [payload, setPayload] = useState<HostMessage | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const parsed = hostMessageSchema.safeParse(event.data);
      if (parsed.success) setPayload(parsed.data);
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
      const target = event.target instanceof Element ? event.target.closest("[data-nid]") : null;
      const id = target?.getAttribute("data-nid") ?? null;
      postToHost({ type: "select", id: id === payload?.tree.id ? null : id });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [payload?.tree.id]);

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
      <PageRenderer tree={payload.tree} breakpoints={payload.breakpoints} />
    </>
  );
}
