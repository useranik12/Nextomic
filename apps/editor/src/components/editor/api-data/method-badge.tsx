"use client";

import type { RestMethod } from "@nextomic/schema";
import { Icon } from "@/lib/icons/Icon";

/** GET green, POST purple, PUT orange, PATCH amber, DELETE red, OPTIONS sky, QUERY teal. */
const METHOD_CLASSES: Record<RestMethod, string> = {
  GET: "bg-success-500/15 text-success-600 dark:text-success-400",
  POST: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  PUT: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELETE: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  OPTIONS: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  QUERY: "bg-teal-500/15 text-teal-600 dark:text-teal-400"
};

/** A call's method; an inactive call shows a muted badge with a red x. */
export function MethodBadge({ method, active }: { method: RestMethod; active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-xs font-medium ${active ? METHOD_CLASSES[method] : "bg-default text-subtle"}`}
      aria-label={active ? method : `${method}, turned off`}
    >
      {active ? (
        <Icon name="ph:check-circle" width={14} height={14} />
      ) : (
        <Icon name="ph:x-circle" width={14} height={14} className="text-danger" />
      )}
      {method}
    </span>
  );
}
