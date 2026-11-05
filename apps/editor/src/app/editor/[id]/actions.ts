"use server";

import {
  createPageInputSchema,
  projectSettingsSchema,
  savePageInputSchema,
  type ProjectSettings
} from "@nextomic/schema";
import { z } from "zod";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import {
  createPage,
  deletePage,
  getPage,
  listPages,
  listVersions,
  restoreVersion,
  savePage,
  saveProjectSettings,
  type PageSummary,
  type SaveResult,
  type StoredPage,
  type VersionSummary
} from "@/server/pages";

export type ActionResult<T> = { data: T; error: null } | { data: null; error: string };

const idSchema = z.string().min(1).max(100);

async function authorize(projectId: string): Promise<string> {
  const parsed = idSchema.safeParse(projectId);
  if (!parsed.success) throw new AccessDeniedError();
  const session = await getServerSession();
  if (!session) throw new AccessDeniedError("Sign in to continue.");
  await requireProjectAccess(session.user.id, parsed.data);
  return session.user.id;
}

function fail<T>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof AccessDeniedError) return { data: null, error: error.message };
  if (error instanceof z.ZodError) {
    return { data: null, error: error.issues[0]?.message ?? "Invalid input." };
  }
  return { data: null, error: fallback };
}

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
