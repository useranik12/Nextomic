"use server";

import {
  createTemplateInputSchema,
  pageSettingsSchema,
  saveTemplateInputSchema,
  type PublishedTemplate,
  templateSettingsSchema
} from "@nextomic/schema";
import { z } from "zod";
import {
  authorizeProject as authorize,
  failResult as fail,
  type ActionResult
} from "@/server/authorize";
import { listLibrary, type LibraryItem } from "@/server/library";
import { getPage, savePage } from "@/server/pages";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getDraftTemplates,
  getTemplate,
  listTemplates,
  saveTemplate,
  type SaveTemplateResult,
  type StoredTemplate,
  type TemplateSummary
} from "@/server/templates";

const idSchema = z.string().min(1).max(100);

export async function listLibraryAction(projectId: string): Promise<ActionResult<LibraryItem[]>> {
  try {
    await authorize(projectId);
    return { data: await listLibrary(projectId), error: null };
  } catch (error) {
    return fail(error, "Could not load pages and templates.");
  }
}

export async function listTemplatesAction(
  projectId: string
): Promise<ActionResult<TemplateSummary[]>> {
  try {
    await authorize(projectId);
    return { data: await listTemplates(projectId), error: null };
  } catch (error) {
    return fail(error, "Could not load templates.");
  }
}

/** The saved header and footer templates with their content, for showing them around a page in the canvas. */
export async function loadLayoutTemplatesAction(
  projectId: string
): Promise<ActionResult<PublishedTemplate[]>> {
  try {
    await authorize(projectId);
    const all = await getDraftTemplates(projectId);
    return { data: all.filter((t) => t.type === "header" || t.type === "footer"), error: null };
  } catch (error) {
    return fail(error, "Could not load the header and footer.");
  }
}

export async function loadTemplateAction(
  projectId: string,
  templateId: string
): Promise<ActionResult<StoredTemplate>> {
  try {
    await authorize(projectId);
    const template = await getTemplate(projectId, idSchema.parse(templateId));
    return template
      ? { data: template, error: null }
      : { data: null, error: "Template not found." };
  } catch (error) {
    return fail(error, "Could not load the template.");
  }
}

export async function createTemplateAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<StoredTemplate>> {
  try {
    const userId = await authorize(projectId);
    const parsed = createTemplateInputSchema.parse(input);
    return { data: await createTemplate(projectId, userId, parsed), error: null };
  } catch (error) {
    return fail(error, "Could not create the template.");
  }
}

export async function saveTemplateAction(
  projectId: string,
  templateId: string,
  input: unknown
): Promise<ActionResult<SaveTemplateResult>> {
  try {
    await authorize(projectId);
    const parsed = saveTemplateInputSchema.parse(input);
    return { data: await saveTemplate(projectId, idSchema.parse(templateId), parsed), error: null };
  } catch (error) {
    return fail(error, "Could not save the template.");
  }
}

export async function duplicateTemplateAction(
  projectId: string,
  templateId: string
): Promise<ActionResult<StoredTemplate>> {
  try {
    const userId = await authorize(projectId);
    const copy = await duplicateTemplate(projectId, idSchema.parse(templateId), userId);
    return copy
      ? { data: copy, error: null }
      : { data: null, error: "Could not duplicate the template." };
  } catch (error) {
    return fail(error, "Could not duplicate the template.");
  }
}

export async function deleteTemplateAction(
  projectId: string,
  templateId: string
): Promise<ActionResult<true>> {
  try {
    await authorize(projectId);
    const removed = await deleteTemplate(projectId, idSchema.parse(templateId));
    return removed ? { data: true, error: null } : { data: null, error: "Template not found." };
  } catch (error) {
    return fail(error, "Could not delete the template.");
  }
}

/**
 * Status change from the manager: a page goes in or out of publishing, a template becomes
 * published or draft. Saved like any edit, so a page open in another tab sees a version conflict
 * rather than losing the change.
 */
export async function setLiveAction(
  projectId: string,
  kind: "page" | "template",
  id: string,
  live: boolean
): Promise<ActionResult<true>> {
  try {
    const userId = await authorize(projectId);
    const itemId = idSchema.parse(id);
    if (kind === "page") {
      const page = await getPage(projectId, itemId);
      if (!page) return { data: null, error: "Page not found." };
      const result = await savePage(projectId, itemId, userId, {
        baseVersion: page.version,
        settings: pageSettingsSchema.parse({
          ...page.settings,
          status: live ? "published" : "draft"
        })
      });
      return result.ok
        ? { data: true, error: null }
        : { data: null, error: "Could not change the status." };
    }
    const template = await getTemplate(projectId, itemId);
    if (!template) return { data: null, error: "Template not found." };
    const result = await saveTemplate(projectId, itemId, {
      baseVersion: template.version,
      settings: templateSettingsSchema.parse({
        ...template.settings,
        status: live ? "published" : "draft"
      })
    });
    return result.ok
      ? { data: true, error: null }
      : { data: null, error: "Could not change the status." };
  } catch (error) {
    return fail(error, "Could not change the status.");
  }
}
