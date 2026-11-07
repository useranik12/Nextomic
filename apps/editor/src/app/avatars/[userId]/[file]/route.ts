import { getStorageAdapter } from "@/lib/storage";
import { AVATAR_FILE, AVATAR_MIME, USER_SEGMENT, sniffAvatarFormat } from "@/server/avatar";

export const dynamic = "force-dynamic";

type Params = Promise<{ userId: string; file: string }>;

// Avatar images. Keys are built from validated segments only, so a request never reaches outside
// `avatars/<userId>/`. File names are random and change on every upload, so they cache forever.
export async function GET(_request: Request, { params }: { params: Params }) {
  const { userId, file } = await params;
  if (!USER_SEGMENT.test(userId) || !AVATAR_FILE.test(file))
    return new Response("Not found", { status: 404 });
  const data = await getStorageAdapter().get(`avatars/${userId}/${file}`);
  const format = data ? sniffAvatarFormat(data) : null;
  if (!data || !format) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": AVATAR_MIME[format],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'"
    }
  });
}
