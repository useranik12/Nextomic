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

import { installCatalogFont, storeUploadedFont, uploadMetaSchema } from "./fonts";

const woff2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, ...new Array(40).fill(1)]);
const meta = {
  family: "Acme Sans",
  category: "sans-serif" as const,
  license: "OFL-1.1",
  rights: true as const,
  files: [{ weight: 400, style: "normal" as const }]
};

beforeEach(() => stored.clear());
afterEach(() => vi.unstubAllGlobals());

describe("upload", () => {
  it("requires the rights confirmation", () => {
    expect(uploadMetaSchema.safeParse({ ...meta, rights: false }).success).toBe(false);
  });

  it("stores a valid file under the project and reads its format from the bytes", async () => {
    const font = await storeUploadedFont("p1", meta, [{ data: woff2 }]);
    expect(font.id).toBe("acme-sans");
    expect(font.files[0]?.format).toBe("woff2");
    expect(font.files[0]?.file).toMatch(/^400-normal-[0-9a-f]{6}\.woff2$/);
    expect(stored.has(`fonts/p1/acme-sans/${font.files[0]?.file}`)).toBe(true);
  });

  it("refuses content that is not a font, whatever the name says", async () => {
    const svg = new TextEncoder().encode("<svg onload=alert(1)></svg>");
    await expect(storeUploadedFont("p1", meta, [{ data: svg }])).rejects.toThrow(/Only woff2/);
    expect(stored.size).toBe(0);
  });

  it("refuses duplicate weight and style, and oversized files", async () => {
    const two = { ...meta, files: [meta.files[0]!, meta.files[0]!] };
    await expect(storeUploadedFont("p1", two, [{ data: woff2 }, { data: woff2 }])).rejects.toThrow(
      /same weight/
    );
    const big = new Uint8Array(2_000_001);
    big.set(woff2);
    await expect(storeUploadedFont("p1", meta, [{ data: big }])).rejects.toThrow(/2 MB/);
  });
});

describe("catalog install", () => {
  const detail = {
    npmVersion: "1.0.0",
    unicodeRange: { latin: "U+0000-00FF" },
    variants: {
      "400": {
        normal: {
          latin: {
            url: {
              woff2: "https://cdn.jsdelivr.net/fontsource/fonts/acme@1.0.0/latin-400-normal.woff2"
            }
          }
        }
      }
    }
  };
  const entry = {
    id: "acme",
    family: "Acme",
    subsets: ["latin"],
    weights: [400],
    styles: ["normal"],
    defSubset: "latin",
    variable: false,
    category: "sans-serif",
    license: "OFL-1.1",
    type: "google"
  };

  function fakeFetch(urls: string[]) {
    return vi.fn(async (input: URL | string) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/v1/fonts?")) return new Response(JSON.stringify([entry]));
      if (url.endsWith("/v1/fonts/acme")) return new Response(JSON.stringify(detail));
      return new Response(woff2);
    });
  }

  it("downloads only from the allowlisted hosts and stores the files", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", fakeFetch(urls));
    const font = await installCatalogFont("p1", {
      id: "acme",
      weights: [400],
      italic: false,
      subsets: ["latin"],
      variable: false
    });
    expect(font.files).toHaveLength(1);
    expect(font.files[0]?.unicodeRange).toBe("U+0000-00FF");
    expect(stored.has("fonts/p1/acme/latin-400-normal.woff2")).toBe(true);
    for (const u of urls)
      expect(["api.fontsource.org", "cdn.jsdelivr.net"]).toContain(new URL(u).hostname);
  });

  it("refuses a file URL on another host", async () => {
    const evil = structuredClone(detail);
    evil.variants["400"].normal.latin.url.woff2 = "https://evil.example/x.woff2";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const url = String(input);
        if (url.includes("/v1/fonts?")) return new Response(JSON.stringify([entry]));
        if (url.endsWith("/v1/fonts/acme")) return new Response(JSON.stringify(evil));
        return new Response(woff2);
      })
    );
    await expect(
      installCatalogFont("p1", {
        id: "acme",
        weights: [400],
        italic: false,
        subsets: ["latin"],
        variable: false
      })
    ).rejects.toThrow(/allowed font source/);
    expect(stored.size).toBe(0);
  });
});
