"use server";

import type { MediaAsset, MediaCounts, MediaFolder, MediaUsage } from "@nextomic/schema";
import { authorizeProject, failResult, type ActionResult } from "@/server/authorize";
import {
  bulkEditMedia,
  createFolder,
  deleteFolder,
  editMedia,
  emptyMediaTrash,
  listFolders,
  listMedia,
  mediaCounts,
  mediaInUse,
  mediaUsage,
  purgeMedia,
  renameFolder,
  restoreMedia,
  takeMediaWrite,
  trashMedia
} from "@/server/media";

// Media library actions. Every one signs the caller in and checks project access first; writes
// also count against a per-user allowance.

async function run<T>(
  projectId: string,
  fallback: string,
  write: boolean,
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const userId = await authorizeProject(projectId);
    if (write) takeMediaWrite(userId);
    return { data: await fn(), error: null };
  } catch (error) {
    return failResult(error, fallback);
  }
}

export interface MediaOverview {
  folders: MediaFolder[];
  counts: MediaCounts;
}

export async function mediaOverviewAction(projectId: string) {
  return run<MediaOverview>(projectId, "Could not load the media library.", false, async () => {
    const [folders, counts] = await Promise.all([listFolders(projectId), mediaCounts(projectId)]);
    return { folders, counts };
  });
}

export async function listMediaAction(projectId: string, query: unknown) {
  return run<{ assets: MediaAsset[]; total: number }>(
    projectId,
    "Could not load files.",
    false,
    () => listMedia(projectId, query)
  );
}

export async function createMediaFolderAction(projectId: string, name: unknown) {
  return run<MediaFolder>(projectId, "Could not create the folder.", true, () =>
    createFolder(projectId, name)
  );
}

export async function renameMediaFolderAction(projectId: string, id: string, name: unknown) {
  return run<MediaFolder>(projectId, "Could not rename the folder.", true, () =>
    renameFolder(projectId, id, name)
  );
}

export async function deleteMediaFolderAction(projectId: string, id: string) {
  return run<true>(projectId, "Could not delete the folder.", true, async () => {
    await deleteFolder(projectId, id);
    return true;
  });
}

export async function editMediaAction(projectId: string, id: string, input: unknown) {
  return run<MediaAsset>(projectId, "Could not save the file.", true, () =>
    editMedia(projectId, id, input)
  );
}

export async function bulkEditMediaAction(
  projectId: string,
  ids: string[],
  input: { folderId?: string | null; addTags?: string[] }
) {
  return run<number>(projectId, "Could not update the files.", true, () =>
    bulkEditMedia(projectId, ids, input)
  );
}

export async function trashMediaAction(projectId: string, ids: string[]) {
  return run<number>(projectId, "Could not move the files to the trash.", true, () =>
    trashMedia(projectId, ids)
  );
}

export async function restoreMediaAction(projectId: string, ids: string[]) {
  return run<number>(projectId, "Could not restore the files.", true, () =>
    restoreMedia(projectId, ids)
  );
}

export async function purgeMediaAction(projectId: string, ids: string[]) {
  return run<number>(projectId, "Could not delete the files.", true, () =>
    purgeMedia(projectId, ids)
  );
}

export async function emptyMediaTrashAction(projectId: string) {
  return run<number>(projectId, "Could not empty the trash.", true, () =>
    emptyMediaTrash(projectId)
  );
}

export async function mediaUsageAction(projectId: string, id: string) {
  return run<MediaUsage[]>(projectId, "Could not check where the file is used.", false, () =>
    mediaUsage(projectId, id)
  );
}

export async function mediaInUseAction(projectId: string, ids: string[]) {
  return run<string[]>(projectId, "Could not check where the files are used.", false, () =>
    mediaInUse(projectId, ids)
  );
}
