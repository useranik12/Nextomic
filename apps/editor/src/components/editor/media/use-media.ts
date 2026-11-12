"use client";

import {
  mediaQuerySchema,
  type MediaAsset,
  type MediaCounts,
  type MediaFolder,
  type MediaQuery
} from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bulkEditMediaAction,
  createMediaFolderAction,
  deleteMediaFolderAction,
  editMediaAction,
  emptyMediaTrashAction,
  listMediaAction,
  mediaInUseAction,
  mediaOverviewAction,
  purgeMediaAction,
  renameMediaFolderAction,
  restoreMediaAction,
  trashMediaAction
} from "@/app/(builder)/editor/[id]/media-actions";
import { uploadFile } from "./upload";

export interface UploadItem {
  key: string;
  name: string;
  progress: number;
  error: string | null;
  done: boolean;
}

export const DEFAULT_QUERY: MediaQuery = mediaQuerySchema.parse({});
const PARALLEL_UPLOADS = 3;

/** State of the Media page: the folder list and counts, one page of files, selection and uploads. */
export function useMedia(projectId: string, initial?: Partial<MediaQuery>) {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [counts, setCounts] = useState<MediaCounts | null>(null);
  const [query, setQuery] = useState<MediaQuery>({ ...DEFAULT_QUERY, ...initial });
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const token = useRef(0);

  const refreshOverview = useCallback(async () => {
    const res = await mediaOverviewAction(projectId);
    if (res.data) {
      setFolders(res.data.folders);
      setCounts(res.data.counts);
    } else setLoadError(res.error);
  }, [projectId]);

  const load = useCallback(
    async (next: MediaQuery, append: boolean) => {
      const mine = ++token.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      const res = await listMediaAction(projectId, next);
      if (mine !== token.current) return;
      setLoading(false);
      setLoadingMore(false);
      if (!res.data) return setLoadError(res.error);
      setLoadError(null);
      const { assets: page, total: count } = res.data;
      setAssets((prev) =>
        append ? [...prev, ...page.filter((a) => !prev.some((p) => p.id === a.id))] : page
      );
      setTotal(count);
    },
    [projectId]
  );

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);
  useEffect(() => {
    void load({ ...query, offset: 0 }, false);
    setSelected(new Set());
  }, [load, query]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshOverview(), load({ ...query, offset: 0 }, false)]);
  }, [refreshOverview, load, query]);

  const patch = useCallback(
    (p: Partial<MediaQuery>) => setQuery((q) => ({ ...q, ...p, offset: 0 })),
    []
  );
  const loadMore = useCallback(() => {
    const next = { ...query, offset: assets.length };
    void load(next, true);
  }, [assets.length, load, query]);

  const run = useCallback(
    async <T>(
      task: Promise<{ data: T | null; error: string | null }>,
      after = true
    ): Promise<T | null> => {
      const res = await task;
      if (res.error !== null || res.data === null) {
        setNotice(res.error ?? "Something went wrong.");
        return null;
      }
      setNotice(null);
      if (after) await refresh();
      return res.data;
    },
    [refresh]
  );

  const replaceAsset = useCallback((asset: MediaAsset) => {
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
  }, []);

  const model = useMemo(
    () => ({
      projectId,
      folders,
      counts,
      query,
      assets,
      total,
      loading,
      loadingMore,
      loadError,
      notice,
      selected,
      uploads,
      patch,
      loadMore,
      refresh,
      setNotice,
      select: (ids: ReadonlySet<string>) => setSelected(ids),
      replaceAsset,
      save: async (id: string, input: unknown) => {
        const asset = await run(editMediaAction(projectId, id, input), false);
        if (asset) {
          replaceAsset(asset);
          await refreshOverview();
        }
        return asset;
      },
      move: (ids: string[], folderId: string | null) =>
        run(bulkEditMediaAction(projectId, ids, { folderId })),
      tag: (ids: string[], addTags: string[]) =>
        run(bulkEditMediaAction(projectId, ids, { addTags })),
      trash: (ids: string[]) => run(trashMediaAction(projectId, ids)),
      restore: (ids: string[]) => run(restoreMediaAction(projectId, ids)),
      purge: (ids: string[]) => run(purgeMediaAction(projectId, ids)),
      emptyTrash: () => run(emptyMediaTrashAction(projectId)),
      inUse: async (ids: string[]) => (await run(mediaInUseAction(projectId, ids), false)) ?? [],
      createFolder: (name: string) => run(createMediaFolderAction(projectId, name)),
      renameFolder: (id: string, name: string) => run(renameMediaFolderAction(projectId, id, name)),
      deleteFolder: async (id: string) => {
        const ok = await run(deleteMediaFolderAction(projectId, id), false);
        if (ok && query.folderId === id) patch({ folderId: null });
        await refreshOverview();
        if (ok)
          await load(
            { ...query, folderId: query.folderId === id ? null : query.folderId, offset: 0 },
            false
          );
        return ok;
      }
    }),
    [
      projectId,
      folders,
      counts,
      query,
      assets,
      total,
      loading,
      loadingMore,
      loadError,
      notice,
      selected,
      uploads,
      patch,
      loadMore,
      refresh,
      run,
      replaceAsset,
      refreshOverview,
      load
    ]
  );

  /** Uploads files a few at a time into the open folder; a failed file keeps its message. */
  const upload = useCallback(
    async (files: File[], replaceId?: string): Promise<MediaAsset | null> => {
      const items: UploadItem[] = files.map((f, i) => ({
        key: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        progress: 0,
        error: null,
        done: false
      }));
      setUploads((prev) => [...prev, ...items]);
      const update = (key: string, p: Partial<UploadItem>) =>
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...p } : u)));
      let last: MediaAsset | null = null;
      let next = 0;
      const worker = async () => {
        while (next < files.length) {
          const i = next++;
          const file = files[i]!;
          const item = items[i]!;
          try {
            last = await uploadFile(projectId, file, {
              folderId: query.folderId,
              ...(replaceId ? { replaceId } : {}),
              onProgress: (f) => update(item.key, { progress: f })
            }).promise;
            update(item.key, { progress: 1, done: true });
          } catch (error) {
            update(item.key, { error: error instanceof Error ? error.message : "Upload failed." });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, files.length) }, worker));
      await refresh();
      window.setTimeout(
        () =>
          setUploads((prev) =>
            prev.filter((u) => u.error !== null || !items.some((x) => x.key === u.key))
          ),
        2500
      );
      return last;
    },
    [projectId, query.folderId, refresh]
  );

  return {
    ...model,
    upload,
    dismissUpload: (key: string) => setUploads((p) => p.filter((u) => u.key !== key))
  };
}

export type MediaModel = ReturnType<typeof useMedia>;
