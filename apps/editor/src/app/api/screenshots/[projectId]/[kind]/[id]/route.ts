import { getDb, pages, templates } from "@nextomic/db";
import { and, eq } from "drizzle-orm";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_BYTES = 1_500_000;

type Params = Promise<{ projectId: string; kind: string; id: string }>;

/** One screenshot per page or template, at a fixed key, so a new one replaces the old file. */
const keyOf = (projectId: string, kind: string, id: string) =>
  `screenshots/${projectId}/${kind}-${id}.webp`;

async function authorized(params: Params) {
  const { projectId, kind, id } = await params;
  if (!SEGMENT.test(projectId) || !SEGMENT.test(id) || (kind !== "page" && kind !== "template"))
    return null;
  const session = await getServerSession();
  if (!session) return null;
  try {
    await requireProjectAccess(session.user.id, projectId);
  } catch (error) {
    if (error instanceof AccessDeniedError) return null;
    throw error;
  }
  return { projectId, kind, id } as const;
}

/** WebP files start with RIFF....WEBP. */
function isWebp(bytes: Uint8Array): boolean {
  const text = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  return bytes.length > 12 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
}

// Screenshots are private to people who can open the project (they can show unpublished work).
export async function GET(_request: Request, { params }: { params: Params }) {
  const target = await authorized(params);
  if (!target) return new Response("Not found", { status: 404 });
  const data = await getStorageAdapter().get(keyOf(target.projectId, target.kind, target.id));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function PUT(request: Request, { params }: { params: Params }) {
  const target = await authorized(params);
  if (!target) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES || !isWebp(bytes))
    return new Response("Send a WebP image up to 1.5 MB.", { status: 400 });
  await getStorageAdapter().put({
    key: keyOf(target.projectId, target.kind, target.id),
    data: bytes,
    contentType: "image/webp"
  });
  const table = target.kind === "page" ? pages : templates;
  await getDb()
    .update(table)
    .set({ screenshotAt: new Date() })
    .where(and(eq(table.id, target.id), eq(table.projectId, target.projectId)));
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const target = await authorized(params);
  if (!target) return new Response("Not found", { status: 404 });
  await getStorageAdapter().delete(keyOf(target.projectId, target.kind, target.id));
  return Response.json({ ok: true });
}
