import { THEME_SLUG_PATTERN } from "@nextomic/schema";
import { getPublishedThemeCss } from "@/server/publish";

export const dynamic = "force-dynamic";

const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;

type Params = Promise<{ projectId: string; file: string }>;

// The CSS of one theme of a published site. Public like the pages that link it. The page links it
// with the publish time in the query, so a new publish gets a new URL and the file can be cached
// for good.
export async function GET(_request: Request, { params }: { params: Params }) {
  const { projectId, file } = await params;
  const slug = file.endsWith(".css") ? file.slice(0, -4) : "";
  if (!SEGMENT.test(projectId) || !THEME_SLUG_PATTERN.test(slug)) {
    return new Response("Not found", { status: 404 });
  }
  const result = await getPublishedThemeCss(projectId, slug);
  if (!result) return new Response("Not found", { status: 404 });
  return new Response(result.css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
