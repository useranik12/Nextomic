"use server";

import { iconKeySchema, iconLibraryListSchema, type IconLibrary } from "@nextomic/schema";
import { z } from "zod";
import { authorizeProject, failResult, type ActionResult } from "@/server/authorize";
import {
  checkIconUpdates,
  installIconSet,
  previewIconUpdate,
  searchIcons,
  searchInputSchema,
  type IconHit,
  type IconUpdateInfo,
  type IconUpdatePreview
} from "@/server/icons";

const versionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/)
  .optional();
const libraryRefSchema = z.object({
  key: iconKeySchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/)
});

/** Downloads a catalog set into project storage. The caller adds the result to the project draft. */
export async function installIconSetAction(
  projectId: string,
  prefix: string,
  version?: string
): Promise<ActionResult<IconLibrary>> {
  try {
    await authorizeProject(projectId);
    return {
      data: await installIconSet(
        projectId,
        iconKeySchema.parse(prefix),
        versionSchema.parse(version)
      ),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not install the icon set.");
  }
}

/** Which installed catalog sets have a newer release. */
export async function checkIconUpdatesAction(
  projectId: string,
  libraries: unknown
): Promise<ActionResult<IconUpdateInfo[]>> {
  try {
    await authorizeProject(projectId);
    return {
      data: await checkIconUpdates(iconLibraryListSchema.parse(libraries)),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not check for icon updates.");
  }
}

/** What an update would add and remove. Nothing is stored until the update is installed. */
export async function previewIconUpdateAction(
  projectId: string,
  library: unknown
): Promise<ActionResult<IconUpdatePreview>> {
  try {
    await authorizeProject(projectId);
    return {
      data: await previewIconUpdate(projectId, libraryRefSchema.parse(library)),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not read the update.");
  }
}

/** One page of icons matching a search, drawn from the enabled libraries. */
export async function searchIconsAction(
  projectId: string,
  libraries: unknown,
  input: unknown
): Promise<ActionResult<{ hits: IconHit[]; total: number }>> {
  try {
    await authorizeProject(projectId);
    return {
      data: await searchIcons(
        projectId,
        iconLibraryListSchema.parse(libraries),
        searchInputSchema.parse(input)
      ),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not search the icons.");
  }
}
