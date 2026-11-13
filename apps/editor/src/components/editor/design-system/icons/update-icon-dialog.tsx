"use client";

import type { IconLibrary } from "@nextomic/schema";
import { useEffect, useState } from "react";
import { previewIconUpdateAction } from "@/app/(builder)/editor/[id]/icon-actions";
import { Busy } from "@/components/ui/busy";
import { ActionButton } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import type { IconUpdatePreview } from "@/server/icons";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; preview: IconUpdatePreview };

/**
 * Shows what an update changes before it is installed: icons added and the names that disappear.
 * The preview downloads and checks the new release but stores nothing.
 */
export function UpdateIconDialog({
  library,
  projectId,
  applying,
  onApply,
  onClose
}: {
  library: Pick<IconLibrary, "key" | "name" | "version" | "sha256">;
  projectId: string;
  applying: boolean;
  onApply: (version: string) => Promise<void>;
  onClose: () => void;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    void previewIconUpdateAction(projectId, { key: library.key, sha256: library.sha256 }).then(
      (res) => {
        if (!live) return;
        setLoad(
          res.error === null
            ? { state: "ready", preview: res.data }
            : { state: "error", message: res.error }
        );
      }
    );
    return () => {
      live = false;
    };
  }, [projectId, library.key, library.sha256]);

  const ready = load.state === "ready" ? load.preview : null;

  return (
    <Dialog
      isOpen
      onClose={onClose}
      size="sm"
      title={`Update ${library.name}`}
      description={
        ready ? `Version ${library.version} to ${ready.latest}` : "Checking the new release"
      }
      footer={
        <>
          <ActionButton tone="secondary" size="md" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            tone="primary"
            size="md"
            isDisabled={!ready}
            isLoading={applying}
            onPress={() => ready && void onApply(ready.latest)}
          >
            Update
          </ActionButton>
        </>
      }
    >
      {load.state === "loading" ? <Busy label="Downloading and checking the new release" /> : null}
      {load.state === "error" ? (
        <p role="alert" className="text-sm text-danger">
          {load.message}
        </p>
      ) : null}
      {ready ? (
        <div className="flex flex-col gap-3 text-sm text-body">
          <p>
            {ready.added} {ready.added === 1 ? "icon" : "icons"} added, {ready.removedCount}{" "}
            removed.
          </p>
          {ready.removedCount > 0 ? (
            <>
              <p className="text-xs text-muted">
                A page that uses a removed icon stops showing it. Removed names
                {ready.removedCount > ready.removed.length
                  ? ` (first ${ready.removed.length})`
                  : ""}
                :
              </p>
              <ul className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                {ready.removed.map((n) => (
                  <li key={n} className="rounded-full bg-default-hover px-2 py-0.5 text-xs">
                    {n}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
