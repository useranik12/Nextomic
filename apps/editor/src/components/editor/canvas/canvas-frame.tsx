"use client";

import { breakpointPreviewWidth } from "@nextomic/schema";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditorStore } from "../store/editor-store";
import { canvasMessageSchema } from "./protocol";

const PADDING = 32;

function useAvailableWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export const CanvasFrame = memo(function CanvasFrame({ mode }: { mode: "light" | "dark" }) {
  const doc = useEditorStore((s) => s.doc);
  const breakpoints = useEditorStore((s) => s.project.breakpoints);
  const activeId = useEditorStore((s) => s.activeBreakpointId);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const { ref: wrapRef, width: available } = useAvailableWidth();

  const active = breakpoints.find((b) => b.id === activeId) ?? breakpoints[0];
  const previewWidth = active ? breakpointPreviewWidth(active) : 1440;
  const usable = Math.max(available - PADDING * 2, 0);
  const scale = usable > 0 && usable < previewWidth ? usable / previewWidth : 1;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const parsed = canvasMessageSchema.safeParse(event.data);
      if (!parsed.success) return;
      if (parsed.data.type === "ready") setReady(true);
      else select(parsed.data.id);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [select]);

  const post = useCallback(() => {
    if (!ready || !doc) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "render", tree: doc.tree, breakpoints, mode, selectedId },
      "*"
    );
  }, [ready, doc, breakpoints, mode, selectedId]);

  useEffect(post, [post]);

  return (
    <div
      ref={wrapRef}
      className="flex h-full w-full justify-center overflow-auto bg-content1/40 p-8"
    >
      <div style={{ width: previewWidth * scale, height: "100%" }} className="shrink-0">
        <iframe
          ref={iframeRef}
          title="Page canvas"
          src="/canvas"
          sandbox="allow-scripts"
          style={{
            width: previewWidth,
            height: scale < 1 ? `calc(100% / ${scale})` : "100%",
            transform: `scale(${scale})`,
            transformOrigin: "top left"
          }}
          className="block rounded-medium border-0 bg-white shadow-lg"
        />
      </div>
    </div>
  );
});
