import type { LibraryItem, LibraryStatus } from "@/server/library";

export type LibraryTab = "pages" | "templates";
export type DateField = "createdAt" | "updatedAt" | "publishedAt";
export type SortKey = "name" | DateField;

export interface LibraryQuery {
  tab: LibraryTab;
  text: string;
  categoryId: string;
  tagId: string;
  status: "all" | LibraryStatus;
  /** Template type filter ("all" for pages). */
  type: string;
  dateField: DateField;
  /** Inclusive day bounds as yyyy-mm-dd; empty means open. */
  from: string;
  to: string;
  sort: SortKey;
  descending: boolean;
}

export const DEFAULT_QUERY: LibraryQuery = {
  tab: "pages",
  text: "",
  categoryId: "all",
  tagId: "all",
  status: "all",
  type: "all",
  dateField: "updatedAt",
  from: "",
  to: "",
  sort: "updatedAt",
  descending: true
};

function dayBounds(from: string, to: string): { start: number; end: number } {
  const start = from ? Date.parse(`${from}T00:00:00`) : Number.NEGATIVE_INFINITY;
  const end = to ? Date.parse(`${to}T23:59:59.999`) : Number.POSITIVE_INFINITY;
  return {
    start: Number.isFinite(start) || from === "" ? start : Number.NEGATIVE_INFINITY,
    end: Number.isFinite(end) || to === "" ? end : Number.POSITIVE_INFINITY
  };
}

const matchesText = (item: LibraryItem, text: string): boolean => {
  const q = text.trim().toLowerCase();
  if (q === "") return true;
  return [item.name, item.route ?? "", item.type ?? "", item.createdBy, item.id].some((v) =>
    v.toLowerCase().includes(q)
  );
};

/** The items one tab shows: filtered by every control, then sorted. Items without a date sort last. */
export function filterLibrary(items: readonly LibraryItem[], q: LibraryQuery): LibraryItem[] {
  const kind = q.tab === "pages" ? "page" : "template";
  const { start, end } = dayBounds(q.from, q.to);
  const rangeOn = q.from !== "" || q.to !== "";
  const out = items.filter((item) => {
    if (item.kind !== kind || !matchesText(item, q.text)) return false;
    if (q.categoryId !== "all" && !item.categoryIds.includes(q.categoryId)) return false;
    if (q.tagId !== "all" && !item.tagIds.includes(q.tagId)) return false;
    if (q.status !== "all" && item.status !== q.status) return false;
    if (q.type !== "all" && item.type !== q.type) return false;
    if (rangeOn) {
      const raw = item[q.dateField];
      if (!raw) return false;
      const at = Date.parse(raw);
      if (at < start || at > end) return false;
    }
    return true;
  });
  const dir = q.descending ? -1 : 1;
  return out.sort((a, b) => {
    if (q.sort === "name") return dir * a.name.localeCompare(b.name);
    const av = a[q.sort];
    const bv = b[q.sort];
    if (!av && !bv) return a.name.localeCompare(b.name);
    if (!av) return 1;
    if (!bv) return -1;
    return dir * (Date.parse(av) - Date.parse(bv)) || a.name.localeCompare(b.name);
  });
}

export const STATUS_LABEL: Record<LibraryStatus, string> = {
  draft: "Draft",
  published: "Published",
  modified: "Modified",
  scheduled: "Scheduled"
};

export function formatDate(iso: string | null): string {
  if (!iso) return "Not yet";
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? "Not yet"
    : at.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
