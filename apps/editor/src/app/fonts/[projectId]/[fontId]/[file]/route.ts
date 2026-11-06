import { FONT_FILE_PATTERN, FONT_MIME, sniffFontFormat } from "@nextomic/schema";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;
const FONT_ID = /^[a-z0-9][a-z0-9-]*$/;

type Params = Promise<{ projectId: string; fontId: string; file: string }>;

// Font files are public like the pages that use them. Keys are built from validated segments only,
// so a request can never reach outside `fonts/<projectId>/<fontId>/`. `*` CORS is needed because
// the editor canvas runs in a sandboxed iframe with an opaque origin.
export async function GET(_request: Request, { params }: { params: Params }) {
  const { projectId, fontId, file } = await params;
  if (!SEGMENT.test(projectId) || !FONT_ID.test(fontId) || !FONT_FILE_PATTERN.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const data = await getStorageAdapter().get(`fonts/${projectId}/${fontId}/${file}`);
  const format = data ? sniffFontFormat(data) : null;
  if (!data || !format) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": FONT_MIME[format],
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
