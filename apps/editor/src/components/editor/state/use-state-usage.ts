"use client";

import { countStateUsage, emptyStateUsage, type StateGroup } from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { stateUsageAction } from "@/app/(builder)/editor/[id]/actions";
import type { StateUsageItem } from "@/server/state-usage";
import { useEditorStore } from "../store/editor-store";

export interface UsagePlace {
  kind: "page" | "template";
  id: string;
  name: string;
  count: number;
}

export interface StateUsage {
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Pages and templates that use `group.name`, with how often. */
  placesOf: (group: StateGroup, name: string) => UsagePlace[];
}

/**
 * Where app state and constants are used. Saved pages and templates come from the server; the item
 * open in the editor is counted from its live (maybe unsaved) version instead.
 */
export function useStateUsage(): StateUsage {
  const projectId = useEditorStore((s) => s.projectId);
  const openId = useEditorStore((s) => s.page?.id ?? "");
  const openName = useEditorStore((s) => s.doc?.name ?? "");
  const openKind = useEditorStore((s) => (s.doc?.template ? "template" : "page"));
  const doc = useEditorStore((s) => s.doc);
  const [saved, setSaved] = useState<StateUsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    setLoading(true);
    stateUsageAction(projectId).then((result) => {
      if (!live) return;
      setLoading(false);
      setError(result.error);
      setSaved(result.data ?? []);
    });
    return () => {
      live = false;
    };
  }, [projectId, tick]);

  const items = useMemo(() => {
    const others = saved.filter((item) => item.id !== openId);
    if (!doc) return others;
    const counts = countStateUsage([doc.tree, doc.settings, doc.template], emptyStateUsage());
    return [...others, { kind: openKind, id: openId, name: openName, counts } as StateUsageItem];
  }, [saved, doc, openId, openName, openKind]);

  const placesOf = useCallback(
    (group: StateGroup, name: string) =>
      items.flatMap((item) => {
        const count = item.counts[group][name] ?? 0;
        return count > 0 ? [{ kind: item.kind, id: item.id, name: item.name, count }] : [];
      }),
    [items]
  );

  return { loading, error, reload: () => setTick((t) => t + 1), placesOf };
}

/** "Home (2), Header (1)" for a confirmation message. */
export function describePlaces(places: UsagePlace[]): string {
  return places.map((p) => `${p.name} (${p.count})`).join(", ");
}
