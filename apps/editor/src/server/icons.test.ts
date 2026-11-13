import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stored = new Map<string, Uint8Array>();
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: () => ({
    put: async (i: { key: string; data: Uint8Array }) => void stored.set(i.key, i.data),
    get: async (k: string) => stored.get(k) ?? null,
    delete: async (k: string) => void stored.delete(k),
    getUrl: async (k: string) => k
  })
}));

import {
  checkIconUpdates,
  compareVersions,
  installIconSet,
  matchNames,
  previewIconUpdate,
  searchIcons
} from "./icons";

const setJson = (names: string[], prefix = "svg-spinners") =>
  JSON.stringify({
    prefix,
    width: 24,
    height: 24,
    icons: Object.fromEntries(names.map((n) => [n, { body: '<path d="M0 0h24v24H0z"/>' }]))
  });
const bytesOf = (text: string) => new TextEncoder().encode(text);
const hashOf = (data: Uint8Array) => createHash("sha256").update(data).digest("base64");

/** A fake jsDelivr: one release per call, with the real listing shape. */
function jsdelivr(releases: Record<string, string>, latest: string, overrideHash?: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      const url = String(input);
      if (url.includes("/resolved?")) return new Response(JSON.stringify({ version: latest }));
      const listing = /@iconify-json\/([^@/]+)@(\d+\.\d+\.\d+)\?structure=flat/.exec(url);
      if (listing) {
        const data = bytesOf(releases[listing[2]!]!);
        return new Response(
          JSON.stringify({
            files: [{ name: "/icons.json", hash: overrideHash ?? hashOf(data), size: data.length }]
          })
        );
      }
      const file = /@iconify-json\/([^@/]+)@(\d+\.\d+\.\d+)\/icons\.json/.exec(url);
      if (file) return new Response(releases[file[2]!]!);
      return new Response("not found", { status: 404 });
    })
  );
}

beforeEach(() => stored.clear());
afterEach(() => vi.unstubAllGlobals());

describe("installIconSet", () => {
  it("downloads, verifies and stores a set under the project, and describes it", async () => {
    jsdelivr({ "1.2.4": setJson(["ring", "dots"]) }, "1.2.4");
    const lib = await installIconSet("p1", "svg-spinners");
    expect(lib).toMatchObject({
      key: "svg-spinners",
      source: "iconify",
      version: "1.2.4",
      count: 2,
      animated: true,
      mode: "svg",
      enabled: true
    });
    expect(lib.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.has(`icons/p1/${lib.file}`)).toBe(true);
    expect(stored.size).toBe(1);
  });

  it("stores nothing when the integrity check fails", async () => {
    jsdelivr({ "1.3.0": setJson(["ring"]) }, "1.3.0", "AAAA");
    await expect(installIconSet("p1", "svg-spinners")).rejects.toThrow(/integrity/);
    expect(stored.size).toBe(0);
  });

  it("refuses a set that is not in the catalog and data that is not an icon set", async () => {
    await expect(installIconSet("p1", "not-a-set")).rejects.toThrow(/not in the catalog/);
    jsdelivr({ "1.0.0": "<html>nope</html>" }, "1.0.0");
    await expect(installIconSet("p1", "line-md")).rejects.toThrow(/could not be read/);
    jsdelivr({ "1.0.1": setJson(["a"], "another") }, "1.0.1");
    await expect(installIconSet("p1", "line-md")).rejects.toThrow(/another set/);
    expect(stored.size).toBe(0);
  });

  it("refuses a set over the size limit before downloading it", async () => {
    const big = vi.fn(async (input: URL | string) => {
      const url = String(input);
      if (url.includes("/resolved?")) return new Response(JSON.stringify({ version: "1.0.0" }));
      return new Response(
        JSON.stringify({ files: [{ name: "/icons.json", hash: "x", size: 70_000_000 }] })
      );
    });
    vi.stubGlobal("fetch", big);
    await expect(installIconSet("p1", "line-md")).rejects.toThrow(/limit/);
    expect(big).toHaveBeenCalledTimes(2);
  });

  it("refuses the 3D Fluent Emoji set up front", async () => {
    await expect(installIconSet("p1", "fluent-emoji")).rejects.toThrow(/limit/);
  });

  it("only talks to the allowlisted package hosts, over https, without redirects", async () => {
    jsdelivr({ "1.4.0": setJson(["ring"]) }, "1.4.0");
    await installIconSet("p1", "svg-spinners");
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [URL, RequestInit][];
    for (const [url, init] of calls) {
      expect(url.protocol).toBe("https:");
      expect(["cdn.jsdelivr.net", "data.jsdelivr.com"]).toContain(url.hostname);
      expect(init.redirect).toBe("manual");
    }
  });
});

describe("updates", () => {
  it("compares versions numerically", () => {
    expect(compareVersions("1.2.10", "1.2.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.4", "1.2.4")).toBe(0);
    expect(compareVersions("1.1.99", "1.2.0")).toBeLessThan(0);
  });

  it("reports an update only when a newer release exists", async () => {
    jsdelivr({ "1.2.5": setJson(["ring"]) }, "1.2.5");
    const info = await checkIconUpdates([
      { key: "svg-spinners", source: "iconify", version: "1.2.4" },
      { key: "line-md", source: "iconify", version: "1.2.5" },
      { key: "mine", source: "upload-svg", version: "" }
    ]);
    expect(info).toEqual([
      { key: "svg-spinners", installed: "1.2.4", latest: "1.2.5", hasUpdate: true },
      { key: "line-md", installed: "1.2.5", latest: "1.2.5", hasUpdate: false }
    ]);
  });

  it("previews added and removed icons and installs the same download", async () => {
    jsdelivr(
      { "1.5.0": setJson(["ring", "dots", "gone"]), "1.5.1": setJson(["ring", "dots", "fresh"]) },
      "1.5.0"
    );
    const lib = await installIconSet("p1", "svg-spinners");
    jsdelivr({ "1.5.0": "", "1.5.1": setJson(["ring", "dots", "fresh"]) }, "1.5.1");
    const preview = await previewIconUpdate("p1", lib);
    expect(preview).toEqual({ latest: "1.5.1", added: 1, removed: ["gone"], removedCount: 1 });
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    const updated = await installIconSet("p1", "svg-spinners", "1.5.1");
    expect(updated.version).toBe("1.5.1");
    // The preview's download is reused, so installing makes no second file request.
    const files = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .slice(calls)
      .filter(([u]) => String(u).includes("/icons.json"));
    expect(files).toHaveLength(0);
  });
});

describe("update keeps earlier releases", () => {
  it("names the file by content, so an old library entry still reads its own release", async () => {
    jsdelivr({ "1.7.0": setJson(["old-icon"]), "1.7.1": setJson(["new-icon"]) }, "1.7.0");
    const v1 = await installIconSet("p1", "svg-spinners");
    jsdelivr({ "1.7.0": setJson(["old-icon"]), "1.7.1": setJson(["new-icon"]) }, "1.7.1");
    const v2 = await installIconSet("p1", "svg-spinners", "1.7.1");
    expect(v1.file).not.toBe(v2.file);
    expect(v1.file).toMatch(/^svg-spinners-[0-9a-f]{8}.json$/);
    expect(stored.has(`icons/p1/${v1.file}`)).toBe(true);
    expect(stored.has(`icons/p1/${v2.file}`)).toBe(true);
    // Discarding the update brings back the v1 entry; it must still find v1's icons.
    const old = await searchIcons("p1", [v1], { query: "", library: "", offset: 0 });
    expect(old.hits.map((h) => h.name)).toEqual(["old-icon"]);
  });
});

describe("search", () => {
  it("ranks whole words before prefixes before fragments", () => {
    expect(
      matchNames(["arrow-left", "left-arrow", "leftover", "overleft", "home"], "left")
    ).toEqual(["arrow-left", "left-arrow", "leftover", "overleft"]);
    expect(matchNames(["a-b", "c"], "")).toEqual(["a-b", "c"]);
    expect(matchNames(["arrow-left", "arrow-right"], "arrow left")).toEqual(["arrow-left"]);
  });

  it("searches enabled libraries, one page at a time, with drawn icons", async () => {
    jsdelivr({ "1.6.0": setJson(["ring", "ring-2", "dots"]) }, "1.6.0");
    const lib = await installIconSet("p1", "svg-spinners");
    const found = await searchIcons("p1", [lib], { query: "ring", library: "", offset: 0 });
    expect(found.total).toBe(2);
    expect(found.hits.map((h) => h.name)).toEqual(["ring", "ring-2"]);
    expect(found.hits[0]?.svg).toContain("<svg");
    const off = await searchIcons("p1", [{ ...lib, enabled: false }], {
      query: "",
      library: "",
      offset: 0
    });
    expect(off).toEqual({ hits: [], total: 0 });
  });

  it("does not serve one project's cached icons to another project", async () => {
    jsdelivr({ "1.6.1": setJson(["ring"]) }, "1.6.1");
    const lib = await installIconSet("p1", "svg-spinners");
    // Same hash and key, but project p2 never stored this library.
    await expect(searchIcons("p2", [lib], { query: "", library: "", offset: 0 })).rejects.toThrow(
      /missing from storage/
    );
  });
});
