import { animationSettingsSchema, type AnimationSettings } from "@nextomic/schema";

// Export and import of timelines as a JSON file, to move them between projects.

const FILE_KIND = "nextomic-animations";

export function exportAnimations(settings: AnimationSettings): string {
  return JSON.stringify({ kind: FILE_KIND, version: 1, ...settings }, null, 2);
}

function freshId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Reads an exported file. Ids are renewed so an import can never overwrite what is already in the
 * project, and a timeline's folder follows the renewed folder id.
 */
export function parseAnimationImport(
  text: string
): { ok: true; settings: AnimationSettings } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (typeof raw !== "object" || raw === null || (raw as { kind?: unknown }).kind !== FILE_KIND) {
    return { ok: false, error: "That file is not a Nextomic animations export." };
  }
  const parsed = animationSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `The file has invalid data: ${issue?.message ?? "unknown error"}.` };
  }
  const folderIds = new Map(parsed.data.folders.map((f) => [f.id, freshId("fo")]));
  return {
    ok: true,
    settings: {
      folders: parsed.data.folders.map((f) => ({ ...f, id: folderIds.get(f.id) ?? f.id })),
      timelines: parsed.data.timelines.map((t) => ({
        ...t,
        id: freshId("tl"),
        folderId: t.folderId ? (folderIds.get(t.folderId) ?? null) : null,
        animations: t.animations.map((a) => ({ ...a, id: freshId("an") }))
      }))
    }
  };
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
