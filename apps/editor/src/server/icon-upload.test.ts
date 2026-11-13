import { beforeEach, describe, expect, it, vi } from "vitest";

const stored = new Map<string, Uint8Array>();
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: () => ({
    put: async (i: { key: string; data: Uint8Array }) => void stored.set(i.key, i.data),
    get: async (k: string) => stored.get(k) ?? null,
    delete: async (k: string) => void stored.delete(k),
    getUrl: async (k: string) => k
  })
}));

import { importIconUpload } from "./icon-upload";
import { searchIcons } from "./icons";

const enc = (text: string) => new TextEncoder().encode(text);
const file = (name: string, text: string) => ({ name, data: enc(text) });
const woff2 = {
  name: "f.woff2",
  data: new Uint8Array([0x77, 0x4f, 0x46, 0x32, ...new Array(40).fill(1)])
};
const ttf = { name: "f.ttf", data: new Uint8Array([0, 1, 0, 0, ...new Array(40).fill(2)]) };
const meta = (extra: object = {}) => ({
  name: "My Icons",
  kind: "svg",
  rights: true,
  takenKeys: [],
  ...extra
});
const svg = (inner: string, attrs = 'viewBox="0 0 24 24"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

beforeEach(() => stored.clear());

describe("rules for every upload", () => {
  it("needs the rights confirmation and at least one file", async () => {
    await expect(
      importIconUpload("p1", meta({ rights: false }), [file("a.svg", svg("<path/>"))])
    ).rejects.toThrow(/right to use/);
    await expect(importIconUpload("p1", meta(), [])).rejects.toThrow(/Choose the files/);
  });
  it("refuses a name that matches a catalog set or an existing library", async () => {
    const f = [file("a.svg", svg("<path/>"))];
    await expect(importIconUpload("p1", meta({ name: "Phosphor" }), f)).resolves.toBeDefined();
    await expect(importIconUpload("p1", meta({ name: "ph" }), f)).rejects.toThrow(/exists/);
    await expect(importIconUpload("p1", meta({ takenKeys: ["my-icons"] }), f)).rejects.toThrow(
      /exists/
    );
    await expect(importIconUpload("p1", meta({ name: "!!!" }), f)).rejects.toThrow(
      /letters or digits/
    );
  });
});

describe("SVG files", () => {
  it("builds a library from sanitized files and reports what it skipped", async () => {
    const { library, skipped } = await importIconUpload("p1", meta(), [
      file("Arrow Left.svg", svg('<path d="M0 0" fill="#f00"/>')),
      file("arrow-left.SVG", svg('<path d="M1 1"/>')),
      file("evil.svg", svg("<script>alert(1)</script>")),
      file("notes.txt", "hello"),
      file("nosize.svg", svg("<path/>", ""))
    ]);
    expect(library).toMatchObject({
      key: "my-icons",
      source: "upload-svg",
      mode: "svg",
      count: 2,
      palette: false
    });
    expect(skipped).toHaveLength(3);
    expect(skipped.join("\n")).toMatch(/evil.svg.*no drawing/);
    expect(skipped.join("\n")).toMatch(/notes.txt.*not an SVG/);
    const data = JSON.parse(new TextDecoder().decode(stored.get(`icons/p1/${library.file}`)));
    expect(Object.keys(data.icons)).toEqual(["arrow-left", "arrow-left-2"]);
    // Recolored by default.
    expect(data.icons["arrow-left"].body).toContain("currentColor");
    expect(data.icons["arrow-left"].body).not.toContain("#f00");
    expect(library.samples).toHaveLength(2);
  });
  it("keeps colors on request and flags animated icons", async () => {
    const { library } = await importIconUpload("p1", meta({ keepColors: true }), [
      file(
        "spin.svg",
        svg(
          '<rect fill="#f00" width="4" height="4"><animate attributeName="width" to="8" dur="1s"/></rect>'
        )
      )
    ]);
    expect(library).toMatchObject({ palette: true, animated: true });
  });
  it("is searchable like any library", async () => {
    const { library } = await importIconUpload("p1", meta(), [
      file("star.svg", svg('<path d="M0 0"/>'))
    ]);
    const found = await searchIcons("p1", [library], { query: "star", library: "", offset: 0 });
    expect(found.hits).toHaveLength(1);
    expect(found.hits[0]?.svg).toContain("<svg");
  });
  it("refuses when nothing is usable", async () => {
    await expect(importIconUpload("p1", meta(), [file("a.txt", "x")])).rejects.toThrow(
      /not an SVG/
    );
    expect(stored.size).toBe(0);
  });
});

describe("Iconify JSON", () => {
  const json = JSON.stringify({
    prefix: "other",
    width: 24,
    height: 24,
    icons: { ok: { body: '<path d="M0 0"/>' }, evil: { body: "<script>x</script>" } }
  });
  it("stores the safe icons under our key", async () => {
    const { library, skipped } = await importIconUpload("p1", meta({ kind: "iconify-json" }), [
      file("set.json", json)
    ]);
    expect(library).toMatchObject({ source: "iconify-json", count: 1, key: "my-icons" });
    expect(skipped[0]).toMatch(/1 icons/);
    const data = JSON.parse(new TextDecoder().decode(stored.get(`icons/p1/${library.file}`)));
    expect(data.prefix).toBe("my-icons");
  });
  it("refuses data that is not an icon set", async () => {
    await expect(
      importIconUpload("p1", meta({ kind: "iconify-json" }), [file("x.json", "{}")])
    ).rejects.toThrow(/not an Iconify/);
    await expect(
      importIconUpload("p1", meta({ kind: "iconify-json" }), [file("x.json", "nope")])
    ).rejects.toThrow(/not valid JSON/);
  });
});

describe("icon fonts", () => {
  const fontMeta = meta({ kind: "font", name: "Brand Font" });
  const selection = JSON.stringify({
    icons: [
      { properties: { name: "home", code: 59648 } },
      { properties: { name: "star", code: 59649 } }
    ]
  });

  it("reads IcoMoon, stores content-named files and a glyph map, never the CSS", async () => {
    const { library } = await importIconUpload("p1", fontMeta, [
      woff2,
      ttf,
      file("selection.json", selection),
      file("style.css", ".x{background:url(http://evil.test/a.png)}")
    ]);
    expect(library).toMatchObject({ source: "icomoon", mode: "font", count: 2, key: "brand-font" });
    expect(library.fontFiles.map((f) => f.format).sort()).toEqual(["ttf", "woff2"]);
    expect(library.fontFiles[0]?.file).toMatch(/^brand-font-[0-9a-f]{8}\.(woff2|ttf)$/);
    expect(library.glyphSamples).toEqual(["e900", "e901"]);
    const data = JSON.parse(new TextDecoder().decode(stored.get(`icons/p1/${library.file}`)));
    expect(data).toEqual({ prefix: "brand-font", glyphs: { home: "e900", star: "e901" } });
    expect([...stored.keys()].some((k) => k.endsWith(".css"))).toBe(false);
    expect(stored.size).toBe(3);
  });
  it("reads Fontello and plain CSS", async () => {
    const fontello = await importIconUpload("p1", fontMeta, [
      woff2,
      file("config.json", JSON.stringify({ glyphs: [{ css: "home", code: 59392 }] }))
    ]);
    expect(fontello.library.source).toBe("fontello");
    const css = await importIconUpload("p1", meta({ kind: "font", name: "Css Font" }), [
      woff2,
      file("icons.css", '.i-home:before{content:"\\e900"} .i-star:before{content:"\\e901"}')
    ]);
    expect(css.library).toMatchObject({ source: "upload-font", count: 2 });
  });
  it("explains what is missing, and refuses bad fonts", async () => {
    await expect(importIconUpload("p1", fontMeta, [woff2])).rejects.toThrow(/selection\.json/);
    await expect(
      importIconUpload("p1", fontMeta, [file("selection.json", selection)])
    ).rejects.toThrow(/font file/);
    await expect(
      importIconUpload("p1", fontMeta, [
        { name: "x.woff2", data: enc("<svg onload=alert(1)></svg>") },
        file("selection.json", selection)
      ])
    ).rejects.toThrow(/not a valid font/);
    await expect(
      importIconUpload("p1", fontMeta, [
        woff2,
        { ...woff2, name: "g.woff2" },
        file("selection.json", selection)
      ])
    ).rejects.toThrow(/one file per format/);
    expect(stored.size).toBe(0);
  });
  it("searches glyphs by name and returns codepoints", async () => {
    const { library } = await importIconUpload("p1", fontMeta, [
      woff2,
      file("selection.json", selection)
    ]);
    const found = await searchIcons("p1", [library], { query: "sta", library: "", offset: 0 });
    expect(found.hits).toEqual([{ library: "brand-font", name: "star", glyph: "e901" }]);
  });
});
