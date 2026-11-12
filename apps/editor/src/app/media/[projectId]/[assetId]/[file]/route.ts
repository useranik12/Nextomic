import { MEDIA_FILE, MEDIA_ID, MEDIA_SEGMENT } from "@nextomic/schema";
import { getMedia, readMediaBytes } from "@/server/media";
import { isVariantWidth, variantBytes, wantsVariant } from "@/server/media-variants";

export const dynamic = "force-dynamic";

type Params = Promise<{ projectId: string; assetId: string; file: string }>;

// Media files are public like the pages that use them. The asset is found by id alone, so a
// replaced file keeps its URL; the file segment is only a readable name. This route shares the
// builder's origin, so every response is locked down: the type comes from the stored sniff result,
// `sandbox` stops scripts in a directly opened SVG, and non-visual files download instead of
// rendering. `*` CORS is needed because the editor canvas runs in a sandboxed iframe.
export async function GET(request: Request, { params }: { params: Params }) {
  const { projectId, assetId, file } = await params;
  if (!MEDIA_SEGMENT.test(projectId) || !MEDIA_ID.test(assetId) || !MEDIA_FILE.test(file))
    return new Response("Not found", { status: 404 });
  const asset = await getMedia(projectId, assetId);
  if (!asset) return new Response("Not found", { status: 404 });

  // `?w=<width>` asks for a resized WebP copy (every current browser takes WebP, so the URL alone
  // decides and shared caches stay correct). An unlisted width, an image already that small, a
  // type that is not resized, or any failure to resize gets the original.
  const asked = Number(new URL(request.url).searchParams.get("w"));
  const width = Number.isInteger(asked) && isVariantWidth(asked) ? asked : null;
  const variant = width !== null && wantsVariant(asset, width) ? width : null;

  const etag = `"${asset.hash.slice(0, 32)}${variant ? `-${variant}w` : ""}"`;
  const headers: Record<string, string> = {
    "Content-Type": asset.mime,
    ETag: etag,
    "Cache-Control": "public, max-age=300, must-revalidate",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Security-Policy":
      asset.kind === "svg"
        ? "sandbox; default-src 'none'; style-src 'unsafe-inline'"
        : "sandbox; default-src 'none'"
  };
  if (asset.kind === "other")
    headers["Content-Disposition"] = `attachment; filename="${asset.fileName}"`;

  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });

  // The ETag comes from the row, so a revalidation never reads the file.
  const loadOriginal = () => readMediaBytes(projectId, assetId);
  if (variant !== null && isVariantWidth(variant)) {
    const resized = await variantBytes(projectId, asset, variant, loadOriginal);
    if (resized)
      return new Response(Buffer.from(resized), {
        headers: {
          ...headers,
          "Content-Type": "image/webp",
          "Content-Length": String(resized.length),
          "Accept-Ranges": "none"
        }
      });
  }
  // The resize failed or was not wanted: the original, under its own tag.
  headers.ETag = `"${asset.hash.slice(0, 32)}"`;
  const data = await loadOriginal();
  if (!data) return new Response("Not found", { status: 404 });

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2]) && data.length > 0) {
    let start = range[1] ? Number(range[1]) : data.length - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : data.length - 1;
    start = Math.max(0, start);
    end = Math.min(end, data.length - 1);
    if (start > end || start >= data.length)
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${data.length}` }
      });
    const slice = Buffer.from(data.subarray(start, end + 1));
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Content-Length": String(slice.length)
      }
    });
  }
  return new Response(Buffer.from(data), {
    headers: { ...headers, "Content-Length": String(data.length) }
  });
}
