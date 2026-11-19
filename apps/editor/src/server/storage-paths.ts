import type { StorageLocation } from "@nextomic/storage";
import { workspaceIdOf } from "./project-workspace";

/**
 * Every storage path of the builder is built here, nowhere else. Buckets are private and are
 * served only through builder routes.
 *
 *   nextomic-builder-assets   the builder's own files (reserved; nothing writes here yet)
 *   customer-data             <user-uid>/user-image/<file>
 *   app-uploads               <workspace-uuid>/<project-uuid>/
 *                               media-assets/<type>/<file>            type = image, video, audio, ...
 *                               media-variants/<asset-uuid>/<etag>-<width>.webp
 *                               fonts/<font-id>/<file>
 *                               icon-libraries/<file>
 *                               screenshots/<kind>/<id>.webp
 *
 * Folders start with the owning uuid so one prefix delete removes everything a user, workspace or
 * project owns (see storage_deletions in the database).
 */
export const BUCKETS = {
  builderAssets: "nextomic-builder-assets",
  customerData: "customer-data",
  appUploads: "app-uploads"
} as const;

const inProject = async (projectId: string, ...rest: string[]): Promise<StorageLocation> => ({
  bucket: BUCKETS.appUploads,
  path: [await workspaceIdOf(projectId), projectId, ...rest].join("/")
});

export const userImagePath = (userUid: string, file: string): StorageLocation => ({
  bucket: BUCKETS.customerData,
  path: `${userUid}/user-image/${file}`
});

/** An uploaded file: its type folder (the mime top level, such as "image") and its own name. */
export const mediaObjectPath = (projectId: string, mimeTop: string, fileName: string) =>
  inProject(projectId, "media-assets", mimeTop, fileName);

export const mediaVariantPath = (projectId: string, assetId: string, variantFile: string) =>
  inProject(projectId, "media-variants", assetId, variantFile);

export const fontFilePath = (projectId: string, fontId: string, file: string) =>
  inProject(projectId, "fonts", fontId, file);

export const iconLibraryPath = (projectId: string, file: string) =>
  inProject(projectId, "icon-libraries", file);

export const screenshotPath = (projectId: string, kind: string, id: string) =>
  inProject(projectId, "screenshots", kind, `${id}.webp`);

/** The folder holding the resized copies of one asset (ends in a slash). */
export const mediaVariantFolder = async (projectId: string, assetId: string) => {
  const { bucket, path } = await inProject(projectId, "media-variants", assetId);
  return { bucket, prefix: `${path}/` };
};
