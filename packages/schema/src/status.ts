import { z } from "zod";

// What a page or template is doing: left out of publishing (draft), live (published) or going live
// at a set time (scheduled). Pages and templates share this.

export const ITEM_STATUSES = ["draft", "published", "scheduled"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "Draft",
  published: "Published",
  scheduled: "Scheduled"
};

/** When a scheduled item goes live: an ISO date and time with its offset, or null. */
export const scheduledAtSchema = z.string().datetime({ offset: true }).nullable().default(null);

export interface StatusFields {
  status: ItemStatus;
  scheduledAt: string | null;
}

/**
 * Whether an item is live at `now`: published, or scheduled with a time that has passed. A
 * scheduled item with no time is not live.
 */
export function isLive(fields: StatusFields, now: number | Date = Date.now()): boolean {
  if (fields.status === "published") return true;
  if (fields.status !== "scheduled" || !fields.scheduledAt) return false;
  const at = Date.parse(fields.scheduledAt);
  return Number.isFinite(at) && at <= (typeof now === "number" ? now : now.getTime());
}
