"use client";

import type { IconLibrary } from "@nextomic/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkIconUpdatesAction,
  installIconSetAction
} from "@/app/(builder)/editor/[id]/icon-actions";
import type { IconUpdateInfo } from "@/server/icons";
import { useEditorStore } from "../../store/editor-store";

export type IconUpdates = Record<string, IconUpdateInfo>;

/**
 * The project's icon libraries: install, replace and update. A set's file is written to storage
 * when it is installed; the library list itself is a draft like every Design System change and is
 * saved with the modal's Save (the same as fonts).
 */
export function useIconLibraries(saveNow: () => Promise<void>) {
  const libraries = useEditorStore((s) => s.project.iconLibraries);
  const projectId = useEditorStore((s) => s.projectId);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [updates, setUpdates] = useState<IconUpdates>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const store = useEditorStore.getState;
  const setLibraries = useCallback(
    (next: IconLibrary[]) => store().patchProject({ iconLibraries: next }),
    [store]
  );

  const mark = (key: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  const fail = (key: string, message: string | null) =>
    setErrors((prev) => {
      const { [key]: _gone, ...rest } = prev;
      return message ? { ...rest, [key]: message } : rest;
    });

  /** Installs or replaces a catalog set; `version` pins a release (updates), else the newest. */
  async function install(prefix: string, version?: string): Promise<boolean> {
    mark(prefix, true);
    fail(prefix, null);
    const res = await installIconSetAction(projectId, prefix, version);
    mark(prefix, false);
    if (res.error !== null) {
      fail(prefix, res.error);
      return false;
    }
    const current = store().project.iconLibraries;
    const old = current.find((l) => l.key === prefix);
    const next = { ...res.data, enabled: old?.enabled ?? true };
    setLibraries([...current.filter((l) => l.key !== prefix), next]);
    setUpdates(({ [prefix]: _done, ...rest }) => rest);
    await saveNow();
    return true;
  }

  const check = useCallback(async () => {
    const installed = store().project.iconLibraries;
    if (!installed.some((l) => l.source === "iconify")) return;
    setChecking(true);
    setCheckError(null);
    const res = await checkIconUpdatesAction(projectId, installed);
    setChecking(false);
    if (res.error !== null) return setCheckError(res.error);
    setUpdates(Object.fromEntries(res.data.filter((u) => u.hasUpdate).map((u) => [u.key, u])));
  }, [projectId, store]);

  // One check when the tab opens; the header button repeats it on demand.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    void check();
  }, [check]);

  const toggle = (key: string, enabled: boolean) =>
    setLibraries(store().project.iconLibraries.map((l) => (l.key === key ? { ...l, enabled } : l)));
  const remove = (key: string) => {
    setLibraries(store().project.iconLibraries.filter((l) => l.key !== key));
    fail(key, null);
  };

  return {
    libraries,
    projectId,
    busy,
    errors,
    updates,
    checking,
    checkError,
    install,
    check,
    toggle,
    remove,
    setLibraries
  };
}
