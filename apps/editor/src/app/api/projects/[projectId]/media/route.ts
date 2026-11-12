import { MEDIA_ID, MEDIA_MAX_UPLOAD_BYTES, MEDIA_SEGMENT } from "@nextomic/schema";
import { AccessDeniedError } from "@/lib/permissions";
import { authorizeProject } from "@/server/authorize";
import { MediaError, replaceMedia, storeMedia, takeMediaWrite } from "@/server/media";

export const dynamic = "force-dynamic";

type Params = Promise<{ projectId: string }>;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Reads the body with a hard byte cap; Content-Length is never trusted. */
async function readCapped(request: Request, cap: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > cap) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

function fileNameOf(request: Request): string {
  const raw = request.headers.get("x-file-name") ?? "";
  try {
    return decodeURIComponent(raw).slice(0, 200) || "file";
  } catch {
    return "file";
  }
}

// One file per request, raw body. Query: `folderId` puts the file in a folder, `replace=<assetId>`
// swaps the bytes of an existing asset. The type comes from the bytes (see sniffMedia).
export async function POST(request: Request, { params }: { params: Params }) {
  const { projectId } = await params;
  if (!MEDIA_SEGMENT.test(projectId)) return json({ error: "Not found." }, 404);
  try {
    const userId = await authorizeProject(projectId);
    takeMediaWrite(userId, "upload");
    const url = new URL(request.url);
    const folderId = url.searchParams.get("folderId");
    const replace = url.searchParams.get("replace");
    if (replace !== null && !MEDIA_ID.test(replace)) return json({ error: "Invalid file." }, 400);
    const data = await readCapped(request, MEDIA_MAX_UPLOAD_BYTES);
    if (!data) return json({ error: "This file is too large." }, 413);
    const file = { name: fileNameOf(request), data };
    const asset = replace
      ? await replaceMedia(projectId, replace, file)
      : await storeMedia(projectId, userId, { ...file, folderId: folderId || null });
    return json({ asset });
  } catch (error) {
    if (error instanceof AccessDeniedError) return json({ error: error.message }, 403);
    if (error instanceof MediaError) return json({ error: error.message }, 400);
    return json({ error: "Could not upload the file." }, 500);
  }
}
