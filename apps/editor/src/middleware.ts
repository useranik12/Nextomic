import { NextResponse, type NextRequest } from "next/server";

// The published site's not-found page needs the address that was asked for (to pick the project
// and to let rules read the URL), and Next does not hand that to not-found files.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-nxt-url", request.nextUrl.href);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/site/:path*"] };
