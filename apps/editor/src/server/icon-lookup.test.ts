import type { ElementNode } from "@nextomic/schema";
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

import { iconLibraryKeys, pageIcons } from "./icon-lookup";
import { importIconUpload } from "./icon-upload";

const enc = (text: string) => new TextEncoder().encode(text);
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
const woff2 = {
  name: "f.woff2",
  data: new Uint8Array([0x77, 0x4f, 0x46, 0x32, ...new Array(40).fill(1)])
};
const selection = JSON.stringify({ icons: [{ properties: { name: "star", code: 59648 } }] });

const icon = (props: Record<string, unknown>, children: ElementNode[] = []): ElementNode =>
  ({
    id: "n",
    type: props.type === "other" ? "heading" : "icon",
    classIds: [],
    props: props as never,
    styles: { breakpoints: {} },
    actions: {},
    children
  }) as ElementNode;

beforeEach(() => stored.clear());

describe("icon libraries a page uses", () => {
  it("lists the libraries of icon elements, skipping SVG-code icons and nested ones count", () => {
    const tree = icon({ type: "other" }, [
      icon({ source: "library", library: "ph", name: "home" }),
      icon({ source: "svg", library: "lucide", svg: "<svg/>" }),
      icon({ source: "library", library: "" }, [icon({ library: "ph" }), icon({ library: "mine" })])
    ]);
    expect(iconLibraryKeys([tree]).sort()).toEqual(["mine", "ph"]);
  });
});

describe("pageIcons", () => {
  it("looks an icon up by a name only known at render time, even when the library is disabled", async () => {
    const { library } = await importIconUpload(
      "p1",
      { name: "Shapes", kind: "svg", rights: true, takenKeys: [] },
      [{ name: "square.svg", data: enc(svg) }]
    );
    const drawn = await pageIcons(
      "p1",
      [{ ...library, enabled: false }],
      [icon({ source: "library", library: "shapes", name: "{{ row }}" })]
    );
    const html = drawn.icons.svg("shapes", "square", { size: "2em", label: "" });
    expect(html).toContain("<svg");
    expect(html).toContain('height="2em"');
    expect(drawn.icons.svg("shapes", "missing", { size: "1em", label: "" })).toBeNull();
    expect(drawn.icons.font("shapes", "square")).toBe(false);
    expect(drawn.iconCss).toBe("");
  });

  it("draws a library the project no longer has as nothing, and loads only libraries in use", async () => {
    const drawn = await pageIcons("p1", [], [icon({ library: "gone", name: "x" })]);
    expect(drawn.icons.svg("gone", "x", { size: "1em", label: "" })).toBeNull();
  });

  it("gives icon fonts a class and their CSS, only for fonts the page uses", async () => {
    const { library } = await importIconUpload(
      "p1",
      { name: "Brand Font", kind: "font", rights: true, takenKeys: [] },
      [woff2, { name: "selection.json", data: enc(selection) }]
    );
    const used = await pageIcons("p1", [library], [icon({ library: "brand-font", name: "star" })]);
    expect(used.icons.font("brand-font", "star")).toBe(true);
    expect(used.icons.font("brand-font", "nope")).toBe(false);
    expect(used.iconCss).toContain('font-family:"nxt-brand-font"');
    expect(used.iconCss).toContain(".nxt-brand-font-star::before");
    expect(used.iconCss).toContain("/icons/p1/");
    const unused = await pageIcons("p1", [library], [icon({ library: "other", name: "x" })]);
    expect(unused.iconCss).toBe("");
  });
});
