"use client";

import { useEffect } from "react";
import { z } from "zod";

// Client side of query loops on published pages (docs/dynamic-data-and-actions.md section 3). The
// server render marks loop elements (`data-nx-loop` and friends); this loads the next rows when
// 90% of the loaded rows have been seen (infinite scroll) and reloads a loop when its Supabase
// table changes (realtime). New rows come from the site loop endpoint as rendered HTML.

const pageSchema = z.object({
  html: z.string(),
  count: z.number().int().min(0),
  hasMore: z.boolean()
});

const RETRY_MS = 5000;
const REALTIME_DEBOUNCE_MS = 300;

export interface LoopRuntimeProps {
  projectId: string;
  /** The page's route, so the endpoint finds the published page. */
  route: string;
  /** Supabase URL and anon key, only for pages with a realtime loop. */
  realtime: { url: string; anonKey: string } | null;
}

export function LoopRuntime({ projectId, route, realtime }: LoopRuntimeProps) {
  useEffect(() => {
    let stopped = false;
    const busy = new Set<HTMLElement>();
    const rowLoop = new WeakMap<Element, HTMLElement>();

    async function fetchPage(key: string, offset: number) {
      const response = await fetch(`/api/site/${encodeURIComponent(projectId)}/loop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ route, search: window.location.search.slice(1), key, offset })
      });
      if (!response.ok) throw new Error(`Loop request failed (${response.status}).`);
      return pageSchema.parse(await response.json());
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const loop = rowLoop.get(entry.target);
        if (loop) void loadMore(loop);
      }
    });

    /** Watches the row at 90% of the loaded rows of an infinite scroll loop. */
    function watch(loop: HTMLElement) {
      if (loop.dataset.nxScroll === undefined || loop.dataset.nxMore !== "1") return;
      const count = Number(loop.dataset.nxCount ?? "0");
      const at = Math.max(0, Math.ceil(count * 0.9) - 1);
      const row = loop.querySelector(`:scope > [data-nx-row="${at}"]`);
      if (!row) return;
      rowLoop.set(row, loop);
      observer.observe(row);
    }

    function scan(root: ParentNode) {
      if (root instanceof HTMLElement && root.dataset.nxLoop !== undefined) watch(root);
      root.querySelectorAll<HTMLElement>("[data-nx-loop]").forEach(watch);
    }

    async function loadMore(loop: HTMLElement) {
      const key = loop.dataset.nxLoop;
      if (!key || busy.has(loop)) return;
      busy.add(loop);
      loop.setAttribute("aria-busy", "true");
      const count = Number(loop.dataset.nxCount ?? "0");
      try {
        const page = await fetchPage(key, count);
        if (stopped) return;
        loop.insertAdjacentHTML("beforeend", page.html);
        loop.dataset.nxCount = String(count + page.count);
        loop.dataset.nxMore = page.hasMore ? "1" : "0";
        scan(loop);
      } catch {
        // Keep what is shown; try again a little later if the visitor is still there.
        window.setTimeout(() => !stopped && watch(loop), RETRY_MS);
      } finally {
        busy.delete(loop);
        loop.removeAttribute("aria-busy");
      }
    }

    /** Loads a loop's first page again (realtime change), replacing its rows. */
    async function reload(loop: HTMLElement) {
      const key = loop.dataset.nxLoop;
      if (!key) return;
      try {
        const page = await fetchPage(key, 0);
        if (stopped) return;
        loop.innerHTML = page.html;
        loop.dataset.nxCount = String(page.count);
        loop.dataset.nxMore = page.hasMore ? "1" : "0";
        scan(loop);
      } catch {
        // The next change tries again.
      }
    }

    scan(document);

    let unwatch: (() => void) | null = null;
    if (realtime) {
      const names = new Set<string>();
      document
        .querySelectorAll<HTMLElement>("[data-nx-realtime]")
        .forEach((el) => names.add(el.dataset.nxRealtime ?? ""));
      const tables = [...names]
        .map((name) => {
          const [schema = "", table = ""] = name.split(".");
          return { schema, table };
        })
        .filter((t) => t.schema && t.table);
      const timers = new Map<string, number>();
      if (tables.length > 0)
        void import("@nextomic/integrations/realtime").then(({ watchTables }) => {
          if (stopped) return;
          unwatch = watchTables(realtime, tables, ({ schema, table }) => {
            const name = `${schema}.${table}`;
            window.clearTimeout(timers.get(name));
            timers.set(
              name,
              window.setTimeout(() => {
                document
                  .querySelectorAll<HTMLElement>("[data-nx-realtime]")
                  .forEach((loop) => loop.dataset.nxRealtime === name && void reload(loop));
              }, REALTIME_DEBOUNCE_MS)
            );
          });
        });
    }

    return () => {
      stopped = true;
      observer.disconnect();
      unwatch?.();
    };
  }, [projectId, route, realtime]);

  return null;
}
