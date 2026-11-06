import { describe, expect, it } from "vitest";
import type { LibraryItem } from "@/server/library";
import { DEFAULT_QUERY, filterLibrary, type LibraryQuery } from "./library-filter";

const item = (over: Partial<LibraryItem>): LibraryItem => ({
  kind: "page",
  id: "id",
  name: "Page",
  route: "/",
  type: null,
  createdBy: "Ana",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-02-01T10:00:00.000Z",
  publishedAt: null,
  status: "draft",
  live: true,
  categoryIds: [],
  tagIds: [],
  screenshotAt: null,
  ...over
});

const items = [
  item({
    id: "a",
    name: "About",
    route: "/about",
    categoryIds: ["c1"],
    status: "published",
    publishedAt: "2026-03-01T10:00:00.000Z"
  }),
  item({
    id: "b",
    name: "Blog",
    route: "/blog",
    tagIds: ["t1"],
    updatedAt: "2026-04-01T10:00:00.000Z"
  }),
  item({ id: "c", name: "Contact", route: "/contact", createdBy: "Bo", status: "modified" }),
  item({ id: "h", kind: "template", type: "header", name: "Main header", route: null })
];

const q = (over: Partial<LibraryQuery>): LibraryQuery => ({ ...DEFAULT_QUERY, ...over });
const ids = (list: LibraryItem[]) => list.map((i) => i.id);

describe("filterLibrary", () => {
  it("keeps one kind per tab", () => {
    expect(ids(filterLibrary(items, q({ tab: "templates" })))).toEqual(["h"]);
    expect(filterLibrary(items, q({ tab: "pages" }))).toHaveLength(3);
  });

  it("searches name, route, creator and id by any part", () => {
    expect(ids(filterLibrary(items, q({ text: "LOG" })))).toEqual(["b"]);
    expect(ids(filterLibrary(items, q({ text: "/con" })))).toEqual(["c"]);
    expect(ids(filterLibrary(items, q({ text: "bo" }))).sort()).toEqual(["b", "c"]);
    expect(filterLibrary(items, q({ text: "zzz" }))).toEqual([]);
  });

  it("filters by category, tag, status and template type", () => {
    expect(ids(filterLibrary(items, q({ categoryId: "c1" })))).toEqual(["a"]);
    expect(ids(filterLibrary(items, q({ tagId: "t1" })))).toEqual(["b"]);
    expect(ids(filterLibrary(items, q({ status: "modified" })))).toEqual(["c"]);
    expect(ids(filterLibrary(items, q({ tab: "templates", type: "footer" })))).toEqual([]);
  });

  it("filters by an inclusive date range on the chosen date", () => {
    const r = q({ dateField: "updatedAt", from: "2026-03-15", to: "2026-04-01" });
    expect(ids(filterLibrary(items, r))).toEqual(["b"]);
    // Items that were never published have no published date, so a range excludes them.
    expect(ids(filterLibrary(items, q({ dateField: "publishedAt", from: "2026-01-01" })))).toEqual([
      "a"
    ]);
  });

  it("sorts by name or date in either direction, undated last", () => {
    expect(ids(filterLibrary(items, q({ sort: "name", descending: false })))).toEqual([
      "a",
      "b",
      "c"
    ]);
    expect(ids(filterLibrary(items, q({ sort: "name", descending: true })))).toEqual([
      "c",
      "b",
      "a"
    ]);
    expect(ids(filterLibrary(items, q({ sort: "updatedAt", descending: true })))[0]).toBe("b");
    expect(ids(filterLibrary(items, q({ sort: "publishedAt", descending: true })))[0]).toBe("a");
    expect(ids(filterLibrary(items, q({ sort: "publishedAt", descending: false })))[0]).toBe("a");
  });
});
