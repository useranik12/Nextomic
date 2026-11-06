"use server";

import { type ProjectFont } from "@nextomic/schema";
import { z } from "zod";
import { authorizeProject, failResult, type ActionResult } from "@/server/authorize";
import {
  FontError,
  installCatalogFont,
  installFontInputSchema,
  searchFonts,
  storeUploadedFont,
  uploadMetaSchema,
  type CatalogFont
} from "@/server/fonts";
import { fontUsageInOtherPages } from "@/server/pages";

const searchSchema = z.object({
  query: z.string().max(80),
  category: z.enum(["all", "sans-serif", "serif", "monospace", "display", "handwriting"]),
  variableOnly: z.boolean(),
  offset: z.number().int().min(0).max(10_000)
});

export async function searchFontsAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<{ fonts: CatalogFont[]; total: number }>> {
  try {
    await authorizeProject(projectId);
    return { data: await searchFonts(searchSchema.parse(input)), error: null };
  } catch (error) {
    return failResult(error, "Could not load the font catalog.");
  }
}

/** Downloads a catalog font into project storage. The caller adds the result to the project. */
export async function installFontAction(
  projectId: string,
  input: unknown
): Promise<ActionResult<ProjectFont>> {
  try {
    await authorizeProject(projectId);
    return {
      data: await installCatalogFont(projectId, installFontInputSchema.parse(input)),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not install the font.");
  }
}

/** Form fields: `meta` (JSON, see uploadMetaSchema) and one `file` entry per font file, in order. */
export async function uploadFontAction(
  projectId: string,
  form: FormData
): Promise<ActionResult<ProjectFont>> {
  try {
    await authorizeProject(projectId);
    const rawMeta = form.get("meta");
    if (typeof rawMeta !== "string") throw new FontError("Missing font details.");
    const meta = uploadMetaSchema.parse(JSON.parse(rawMeta));
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    const blobs = await Promise.all(
      files.map(async (f) => ({ data: new Uint8Array(await f.arrayBuffer()) }))
    );
    return { data: await storeUploadedFont(projectId, meta, blobs), error: null };
  } catch (error) {
    if (error instanceof SyntaxError) return { data: null, error: "Invalid font details." };
    return failResult(error, "Could not upload the font.");
  }
}

/** Elements naming each family on the other saved pages (the open page is counted live). */
export async function fontUsageAction(
  projectId: string,
  exceptPageId: string,
  families: string[]
): Promise<ActionResult<Record<string, number>>> {
  try {
    await authorizeProject(projectId);
    const parsed = z.array(z.string().max(64)).max(40).parse(families);
    return {
      data: await fontUsageInOtherPages(
        projectId,
        z.string().min(1).max(100).parse(exceptPageId),
        parsed
      ),
      error: null
    };
  } catch (error) {
    return failResult(error, "Could not count font usage.");
  }
}
