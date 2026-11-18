import { NextResponse, type NextRequest } from "next/server";
import { hasBadId } from "@/lib/id-guard";

// Two jobs. A route whose path holds a row id answers 404 when the id is not a uuid (Postgres would
// refuse the text and the page would fail with a server error). And the published site's not-found
// page needs the address that was asked for (to pick the project and to let rules read the URL),
// which Next does not hand to not-found files.
export function proxy(request: NextRequest) {
  if (hasBadId(request.nextUrl.pathname)) return new NextResponse(null, { status: 404 });
  const headers = new Headers(request.headers);
  headers.set("x-nxt-url", request.nextUrl.href);
  return NextResponse.next({ request: { headers } });
}

// Next reads this at build time, so it must be a literal. Keep it in step with GUARDED in lib/id-guard.ts (a test checks).
export const config = {
  matcher: [
    "/editor/:path*",
    "/preview/:path*",
    "/site/:path*",
    "/media/:path*",
    "/fonts/:path*",
    "/icons/:path*",
    "/theme-css/:path*"
  ]
};
