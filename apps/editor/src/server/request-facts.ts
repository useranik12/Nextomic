import type { RequestFacts } from "./site-layout";

/** The request as rules and tags read it, from the incoming headers. */
export function requestFacts(headers: Headers, fallbackPath: string, query: string): RequestFacts {
  const raw = headers.get("x-nxt-url");
  let url: URL | null = null;
  try {
    url = raw ? new URL(raw) : null;
  } catch {
    url = null;
  }
  return {
    url: url?.href ?? fallbackPath,
    host: url?.host ?? headers.get("host") ?? "",
    path: url?.pathname ?? fallbackPath,
    query: url ? url.search.replace(/^\?/, "") : query,
    referrer: headers.get("referer") ?? "",
    userAgent: headers.get("user-agent") ?? "",
    language: (headers.get("accept-language") ?? "").split(",")[0]?.split(";")[0]?.trim() ?? ""
  };
}
