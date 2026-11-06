import type { FontFile, ProjectFont } from "@nextomic/schema";
import { uploadFontAction } from "@/app/(builder)/editor/[id]/font-actions";
import { fileKey } from "./font-model";

export interface FaceInput {
  file: File;
  weight: number;
  /** Variable fonts: the top of the weight range. */
  weightMax?: number;
  style: "normal" | "italic";
}

/** The server takes this many files in one request. */
const PER_REQUEST = 12;

/**
 * Sends font files to the server one request at a time and returns the stored faces. Two inputs
 * with the same weight and style are one face (the later file wins), so a bulk pick of messy
 * files cannot fail on a duplicate.
 */
export async function uploadFaces(
  projectId: string,
  font: Pick<ProjectFont, "family" | "category" | "license">,
  inputs: readonly FaceInput[]
): Promise<{ files: FontFile[] } | { error: string }> {
  const unique = [...new Map(inputs.map((i) => [fileKey(i), i])).values()];
  const files: FontFile[] = [];
  for (let at = 0; at < unique.length; at += PER_REQUEST) {
    const batch = unique.slice(at, at + PER_REQUEST);
    const form = new FormData();
    form.set(
      "meta",
      JSON.stringify({
        family: font.family,
        category: font.category,
        license: font.license,
        rights: true,
        files: batch.map((b) => ({ weight: b.weight, weightMax: b.weightMax, style: b.style }))
      })
    );
    for (const b of batch) form.append("file", b.file);
    const result = await uploadFontAction(projectId, form);
    if (result.error !== null) return { error: result.error };
    files.push(...result.data.files);
  }
  return { files };
}
