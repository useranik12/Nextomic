"use server";

import {
  CLASS_NAME_PATTERN,
  FRAMEWORK_VAR_PATTERN,
  VARIABLE_NAME_PATTERN,
  createPageInputSchema,
  projectSettingsSchema,
  savePageInputSchema,
  stateNameSchema,
  type ProjectSettings
} from "@nextomic/schema";
import { z } from "zod";
import {
  authorizeProject as authorize,
  failResult as fail,
  type ActionResult
} from "@/server/authorize";
import {
  classUsageInOtherPages,
  createPage,
  setHomePage,
  deletePage,
  duplicatePage,
  getPage,
  listPages,
  listVersions,
  renameCssVarsInOtherPages,
  renameVariableInOtherPages,
  replaceClassInOtherPages,
  restoreVersion,
  savePage,
  saveProjectSettings,
  type PageSummary,
  type SaveResult,
  type StoredPage,
  variableUsageInOtherPages,
  type VersionSummary
} from "@/server/pages";
import {
  renameStateTagEverywhere,
  stateUsageByItem,
  type StateUsageItem
} from "@/server/state-usage";
import {
  getPublishState,
  publishProject,
  schedulePublish,
  unpublishProject,
  type PublishState
} from "@/server/publish";

const idSchema = z.string().min(1).max(100);

export async function listPagesAction(projectId: string): Promise<ActionResult<PageSummary[]>> {
  try {
    await authorize(projectId);
    return { data: await listPages(projectId), error: null };
  } catch (error) {
    return fail(error, "Could not load pages.");
  }
}

export async function loadPageAction(
  projectId: string,
  pageId: string
): Promise<ActionResult<StoredPage>> {
  try {
    await authorize(projectId);
    const page = await getPage(projectId, idSchema.parse(pageId));
    if (!page) return { data: null, error: "Page not found." };
    return { data: page, error: null };
  } catch (error) {
    return fail(error, "Could not load the page.");
  }
}

export async function createPageAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<StoredPage>> {
  try {
    const userId = await authorize(projectId);
    const parsed = createPageInputSchema.parse(input);
    const result = await createPage(projectId, userId, parsed);
    if (result === "route-taken") return { data: null, error: "That route is already used." };
    return { data: result, error: null };
  } catch (error) {
    return fail(error, "Could not create the page.");
  }
}

export async function savePageAction(
  projectId: string,
  pageId: string,
  input: unknown
): Promise<ActionResult<SaveResult>> {
  try {
    const userId = await authorize(projectId);
    const parsed = savePageInputSchema.parse(input);
    const result = await savePage(projectId, idSchema.parse(pageId), userId, parsed);
    return { data: result, error: null };
  } catch (error) {
    return fail(error, "Could not save the page.");
  }
}

export async function duplicatePageAction(
  projectId: string,
  pageId: string
): Promise<ActionResult<StoredPage>> {
  try {
    const userId = await authorize(projectId);
    const copy = await duplicatePage(projectId, idSchema.parse(pageId), userId);
    return copy
      ? { data: copy, error: null }
      : { data: null, error: "Could not duplicate the page." };
  } catch (error) {
    return fail(error, "Could not duplicate the page.");
  }
}

export async function deletePageAction(
  projectId: string,
  pageId: string
): Promise<ActionResult<true>> {
  try {
    await authorize(projectId);
    const pageList = await listPages(projectId);
    if (pageList.length <= 1) return { data: null, error: "A project needs at least one page." };
    const removed = await deletePage(projectId, idSchema.parse(pageId));
    return removed ? { data: true, error: null } : { data: null, error: "Page not found." };
  } catch (error) {
    return fail(error, "Could not delete the page.");
  }
}

export async function listVersionsAction(
  projectId: string,
  pageId: string
): Promise<ActionResult<VersionSummary[]>> {
  try {
    await authorize(projectId);
    return { data: await listVersions(projectId, idSchema.parse(pageId)), error: null };
  } catch (error) {
    return fail(error, "Could not load version history.");
  }
}

export async function restoreVersionAction(
  projectId: string,
  pageId: string,
  version: number
): Promise<ActionResult<SaveResult>> {
  try {
    const userId = await authorize(projectId);
    const result = await restoreVersion(
      projectId,
      idSchema.parse(pageId),
      userId,
      z.number().int().min(1).parse(version)
    );
    return { data: result, error: null };
  } catch (error) {
    return fail(error, "Could not restore that version.");
  }
}

export async function saveProjectSettingsAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<ProjectSettings>> {
  try {
    await authorize(projectId);
    const parsed = projectSettingsSchema.parse(input);
    return { data: await saveProjectSettings(projectId, parsed), error: null };
  } catch (error) {
    return fail(error, "Could not save project settings.");
  }
}

export interface PublishInfo {
  /** Epoch milliseconds of the last publish, null when the project is not published. */
  publishedAt: number | null;
  publishedPages: number;
  hasUnpublishedChanges: boolean;
  /** Epoch milliseconds of the scheduled publish, null when none is set. */
  scheduledPublishAt: number | null;
}

function toInfo(state: PublishState): PublishInfo {
  return {
    publishedAt: state.publishedAt?.getTime() ?? null,
    publishedPages: state.publishedPages,
    hasUnpublishedChanges: state.hasUnpublishedChanges,
    scheduledPublishAt: state.scheduledPublishAt?.getTime() ?? null
  };
}

export async function getPublishStateAction(projectId: string): Promise<ActionResult<PublishInfo>> {
  try {
    await authorize(projectId);
    return { data: toInfo(await getPublishState(projectId)), error: null };
  } catch (error) {
    return fail(error, "Could not read the publish state.");
  }
}

export async function publishAction(projectId: string): Promise<ActionResult<PublishInfo>> {
  try {
    await authorize(projectId);
    return { data: toInfo(await publishProject(projectId)), error: null };
  } catch (error) {
    return fail(error, "Could not publish the project.");
  }
}

// A scheduled publish must be in the future and within five years.
const scheduleSchema = z
  .string()
  .datetime({ offset: true })
  .transform((iso) => new Date(iso))
  .refine((at) => at.getTime() > Date.now(), "Pick a time in the future.")
  .refine(
    (at) => at.getTime() < Date.now() + 5 * 365 * 24 * 3600 * 1000,
    "Pick a time within five years."
  )
  .nullable();

export async function schedulePublishAction(
  projectId: string,
  at: string | null
): Promise<ActionResult<PublishInfo>> {
  try {
    await authorize(projectId);
    const parsed = scheduleSchema.safeParse(at);
    if (!parsed.success)
      return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid time." };
    return { data: toInfo(await schedulePublish(projectId, parsed.data)), error: null };
  } catch (error) {
    return fail(error, "Could not schedule the publish.");
  }
}

export async function unpublishAction(projectId: string): Promise<ActionResult<PublishInfo>> {
  try {
    await authorize(projectId);
    return { data: toInfo(await unpublishProject(projectId)), error: null };
  } catch (error) {
    return fail(error, "Could not unpublish the project.");
  }
}

const classNameSchema = z.string().regex(CLASS_NAME_PATTERN).max(64);

export async function classUsageAction(
  projectId: string,
  exceptPageId: string
): Promise<ActionResult<Record<string, number>>> {
  try {
    await authorize(projectId);
    return {
      data: await classUsageInOtherPages(projectId, idSchema.parse(exceptPageId)),
      error: null
    };
  } catch (error) {
    return fail(error, "Could not count class usage.");
  }
}

/** `to` null removes the class from the other pages; the open page is changed in the editor. */
export async function replaceClassAction(
  projectId: string,
  exceptPageId: string,
  from: string,
  to: string | null
): Promise<ActionResult<number>> {
  try {
    await authorize(projectId);
    const updated = await replaceClassInOtherPages(
      projectId,
      idSchema.parse(exceptPageId),
      classNameSchema.parse(from),
      to === null ? null : classNameSchema.parse(to)
    );
    return { data: updated, error: null };
  } catch (error) {
    return fail(error, "Could not update the other pages.");
  }
}

const variableNameSchema = z.string().regex(VARIABLE_NAME_PATTERN).max(48);
const frameworkVarNameSchema = z.string().regex(FRAMEWORK_VAR_PATTERN).max(64);

export async function variableUsageAction(
  projectId: string,
  exceptPageId: string
): Promise<ActionResult<Record<string, number>>> {
  try {
    await authorize(projectId);
    return {
      data: await variableUsageInOtherPages(projectId, idSchema.parse(exceptPageId)),
      error: null
    };
  } catch (error) {
    return fail(error, "Could not count variable usage.");
  }
}

/** Rewrites references on the other pages; the open page and classes change in the editor. */
export async function renameCssVarsAction(
  projectId: string,
  exceptPageId: string,
  pairs: [string, string][]
): Promise<ActionResult<number>> {
  try {
    await authorize(projectId);
    const checked = z
      .array(z.tuple([frameworkVarNameSchema, frameworkVarNameSchema]))
      .max(1000)
      .parse(pairs);
    const updated = await renameCssVarsInOtherPages(
      projectId,
      idSchema.parse(exceptPageId),
      checked
    );
    return { data: updated, error: null };
  } catch (error) {
    return fail(error, "Could not update the other pages.");
  }
}

export async function renameVariableAction(
  projectId: string,
  exceptPageId: string,
  from: string,
  to: string
): Promise<ActionResult<number>> {
  try {
    await authorize(projectId);
    const updated = await renameVariableInOtherPages(
      projectId,
      idSchema.parse(exceptPageId),
      variableNameSchema.parse(from),
      variableNameSchema.parse(to)
    );
    return { data: updated, error: null };
  } catch (error) {
    return fail(error, "Could not update the other pages.");
  }
}

/** Pages and templates that use app state or constants (saved versions; the open item counts live). */
export async function stateUsageAction(projectId: string): Promise<ActionResult<StateUsageItem[]>> {
  try {
    await authorize(projectId);
    return { data: await stateUsageByItem(projectId), error: null };
  } catch (error) {
    return fail(error, "Could not find where the variables are used.");
  }
}

/** Points {{app.from}} or {{const.from}} tags at the new name; the open item changes in the editor. */
export async function renameStateTagAction(
  projectId: string,
  exceptId: string,
  group: "app" | "const",
  from: string,
  to: string
): Promise<ActionResult<number>> {
  try {
    await authorize(projectId);
    const updated = await renameStateTagEverywhere(
      projectId,
      idSchema.parse(exceptId),
      z.enum(["app", "const"]).parse(group),
      stateNameSchema.parse(from),
      stateNameSchema.parse(to)
    );
    return { data: updated, error: null };
  } catch (error) {
    return fail(error, "Could not update the other pages and templates.");
  }
}

export async function setHomePageAction(
  projectId: string,
  pageId: string
): Promise<ActionResult<null>> {
  try {
    await authorize(projectId);
    const ok = await setHomePage(projectId, z.string().min(1).max(64).parse(pageId));
    if (!ok) return { data: null, error: "That page was not found." };
    return { data: null, error: null };
  } catch (error) {
    return fail(error, "Could not set the home page.");
  }
}
