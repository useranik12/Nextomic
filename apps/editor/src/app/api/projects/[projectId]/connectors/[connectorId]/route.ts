import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { AccessDeniedError, requireProjectAccess } from "@/lib/permissions";
import { proxyConnectorCall } from "@/server/connectors/proxy";

// POST { op: "test" | "resources" | "execute", request? } runs a connector call for the editor
// preview, so connector secrets stay on the server. Same-origin JSON only.

const MAX_BODY_BYTES = 1_000_000;

const STATUS_BY_CODE: Partial<Record<string, number>> = {
  invalid_request: 400,
  not_found: 404,
  rate_limited: 429
};

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const deny = (status: number, message: string) =>
  NextResponse.json({ ok: false, error: { code: "invalid_request", message } }, { status });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; connectorId: string }> }
) {
  if (!sameOrigin(req)) return deny(403, "Cross-site requests are not allowed.");
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return deny(415, "Send JSON.");
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return deny(401, "Sign in to continue.");
  const { projectId, connectorId } = await params;
  let workspaceId: string;
  try {
    ({
      membership: { workspaceId }
    } = await requireProjectAccess(session.user.id, projectId));
  } catch (error) {
    if (error instanceof AccessDeniedError) return deny(403, error.message);
    throw error;
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return deny(413, "The request is too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return deny(400, "The request is not valid JSON.");
  }
  const result = await proxyConnectorCall(
    { userId: session.user.id, projectId, workspaceId },
    connectorId,
    body
  );
  const status = result.ok ? 200 : (STATUS_BY_CODE[result.error.code] ?? 502);
  return NextResponse.json(result, { status, headers: { "cache-control": "no-store" } });
}
