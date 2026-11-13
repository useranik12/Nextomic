import { FONT_MIME, ICON_FONT_FILE_PATTERN, sniffFontFormat } from "@nextomic/schema";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;

type Params = Promise<{ projectId: string; file: string }>;

// Uploaded icon font files are public like the pages that use them. Only content-named font files
// are served (never the library's JSON data), and the keys come from validated segments, so a
// request cannot reach outside `icons/<projectId>/`. `*` CORS is needed because the editor canvas
// runs in a sandboxed iframe with an opaque origin.
export async function GET(_request: Request, { params }: { params: Params }) {
  const { projectId, file } = await params;
  if (!SEGMENT.test(projectId) || !ICON_FONT_FILE_PATTERN.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const data = await getStorageAdapter().get(`icons/${projectId}/${file}`);
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
