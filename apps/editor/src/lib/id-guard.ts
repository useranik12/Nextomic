import { isUuid } from "@nextomic/schema";

// File routes whose path holds row ids (pages check their own id and show the not-found page). (API routes check their ids in the handler: the
// proxy would buffer large upload bodies.) Each entry lists the path segments (after the first one) that
// must be uuids; a bad one is answered 404 before any code reaches the database.
const GUARDED: ReadonlyArray<{ prefix: string; uuidAt: readonly number[] }> = [
  { prefix: "media", uuidAt: [1, 2] },
  { prefix: "fonts", uuidAt: [1] },
  { prefix: "icons", uuidAt: [1] },
  { prefix: "theme-css", uuidAt: [1] },
  { prefix: "avatars", uuidAt: [1] }
];

/** True when a guarded route's path carries an id that is not a uuid. */
export function hasBadId(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  for (const { prefix, uuidAt } of GUARDED) {
    const head = prefix.split("/");
    if (!head.every((segment, i) => parts[i] === segment)) continue;
    return uuidAt.some((i) => parts[i] !== undefined && !isUuid(safeDecode(parts[i])));
  }
  return false;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The matcher the proxy needs: one entry per guarded prefix. */
export const GUARDED_MATCHERS: string[] = GUARDED.map(({ prefix }) => `/${prefix}/:path*`);
