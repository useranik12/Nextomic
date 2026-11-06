"use client";

import { useCallback, useEffect, useState } from "react";
import { listVersionsAction, restoreVersionAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton } from "@/components/ui/controls";
import { useEditorStore } from "./store/editor-store";
import type { VersionSummary } from "@/server/pages";

const FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function VersionHistory({ saveNow }: { saveNow: () => Promise<void> }) {
  const pageId = useEditorStore((s) => s.page?.id);
  const version = useEditorStore((s) => s.page?.version);
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const versionControl = useEditorStore((s) => s.project.versionControl);

  const load = useCallback(async () => {
    if (!pageId) return;
    const result = await listVersionsAction(useEditorStore.getState().projectId, pageId);
    if (result.error !== null) setError(result.error);
    else {
      setError(null);
      setVersions(result.data);
    }
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  async function restore(target: number) {
    if (!pageId) return;
    setBusy(true);
    await saveNow();
    const result = await restoreVersionAction(useEditorStore.getState().projectId, pageId, target);
    setBusy(false);
    setConfirming(null);
    if (result.error !== null) return setError(result.error);
    const outcome = result.data;
    if (!outcome.ok) {
      setError(
        outcome.reason === "conflict"
          ? "The page changed elsewhere. Reload and try again."
          : "Could not restore that version."
      );
      return;
    }
    const page = outcome.page;
    useEditorStore
      .getState()
      .loadPage(
        { id: page.id, version: page.version },
        { name: page.name, route: page.route, settings: page.settings, tree: page.tree }
      );
    setError(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="px-3 py-2 text-small font-medium text-foreground">Version history</h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {versionControl ? null : (
          <p role="status" className="px-2 py-2 text-small text-default-600">
            Version control is off, so new saves are not added to the history. Turn it on in App
            Settings. Existing versions can still be restored.
          </p>
        )}
        {error ? (
          <p role="alert" className="px-2 py-2 text-small text-danger">
            {error}
          </p>
        ) : null}
        {versions === null && !error ? (
          <p className="px-2 py-4 text-small text-default-500">Loading…</p>
        ) : null}
        {versions?.length === 0 ? (
          <p className="px-2 py-4 text-small text-default-500">No versions yet.</p>
        ) : null}
        <ol className="flex flex-col gap-1">
          {versions?.map((item) => {
            const current = item.version === version;
            return (
              <li key={item.version} className="rounded-medium px-2 py-2 hover:bg-default-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-small text-foreground">
                      Version {item.version}
                      {current ? (
                        <span className="ml-2 text-tiny text-success">Current</span>
                      ) : null}
                    </p>
                    <p className="text-tiny text-default-500">{FORMAT.format(item.savedAt)}</p>
                  </div>
                  {current ? null : confirming === item.version ? (
                    <div className="flex gap-1">
                      <ActionButton
                        size="sm"
                        isLoading={busy}
                        onPress={() => void restore(item.version)}
                      >
                        Restore
                      </ActionButton>
                      <ActionButton size="sm" tone="ghost" onPress={() => setConfirming(null)}>
                        Cancel
                      </ActionButton>
                    </div>
                  ) : (
                    <ActionButton
                      size="sm"
                      tone="ghost"
                      onPress={() => setConfirming(item.version)}
                    >
                      Restore…
                    </ActionButton>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
