import { NextResponse, type NextRequest } from "next/server";
import { hasBadId } from "@/lib/id-guard";
import { refreshSession } from "@/lib/supabase/proxy";

// Three jobs. A file route whose path holds a row id answers 404 when the id is not a uuid (Postgres
// would refuse the text and the page would fail with a server error). The published site's
// not-found page needs the address that was asked for (to pick the project and to let rules read
// the URL), which Next does not hand to not-found files. And every builder route keeps the
// builder session fresh: the access token lives an hour, so an expired one is swapped for a new one
// here, before the page renders. Published sites and file routes belong to visitors and never touch
// the builder session.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (hasBadId(pathname)) return new NextResponse(null, { status: 404 });
  const headers = new Headers(request.headers);
  headers.set("x-nxt-url", request.nextUrl.href);
  if (isVisitorRoute(pathname)) return NextResponse.next({ request: { headers } });
  return refreshSession(request, headers);
}

const VISITOR_PREFIXES = [
  "/site/",
  "/media/",
  "/fonts/",
  "/icons/",
  "/theme-css/",
  "/avatars/",
  "/brand/",
  "/api/site/"
];

function isVisitorRoute(pathname: string): boolean {
  return VISITOR_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Next reads this at build time, so it must be a literal. Keep the file routes in step with GUARDED in lib/id-guard.ts (a test checks).
export const config = {
  matcher: [
    "/site/:path*",
    "/media/:path*",
    "/fonts/:path*",
    "/icons/:path*",
    "/theme-css/:path*",
    "/avatars/:path*",
    {
      source:
        "/((?!_next/|site/|media/|fonts/|icons/|theme-css/|avatars/|brand/|api/site/|favicon[.]ico).*)",
      // Next buffers (and past 10 MB cuts) a request body that passes through this file, so requests
      // that declare a body of 1 MB or more (uploads) skip the session refresh.
      missing: [{ type: "header", key: "content-length", value: "[0-9]{7,}" }]
    }
  ]
};
