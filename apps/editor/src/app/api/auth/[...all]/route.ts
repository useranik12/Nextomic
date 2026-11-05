import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";

async function getHandlers() {
  const { auth } = await import("@/lib/auth");
  return toNextJsHandler(auth);
}

export async function GET(request: Request): Promise<Response> {
  return (await getHandlers()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return (await getHandlers()).POST(request);
}
