import { describe, expect, it } from "vitest";
import {
  countFamilyInStyles,
  fontListSchema,
  fontPreloads,
  fontStack,
  fontWeight,
  fontsCss,
  mentionsFamily,
  sniffFontFormat,
  type ProjectFont
} from "./fonts";

const sha = "a".repeat(64);
const inter: ProjectFont = {
  id: "inter",
  family: "Inter",
  source: "google",
  sourceNote: "",
  category: "sans-serif",
  license: "OFL-1.1",
  active: true,
  favorite: false,
  rights: true,
  preload: true,
  display: "swap",
  files: [
    {
      file: "latin-400-normal.woff2",
      format: "woff2",
      weight: 400,
      style: "normal",
      subset: "latin",
      unicodeRange: "U+0000-00FF,U+0131",
      bytes: 20000,
      sha256: sha
    },
    {
      file: "latin-ext-wght-normal.woff2",
      format: "woff2",
      weight: 100,
      weightMax: 900,
      style: "normal",
      subset: "latin-ext",
      bytes: 30000,
      sha256: sha
    }
  ]
};

describe("fontsCss", () => {
  it("writes one @font-face per file with swap, range and weight span", () => {
    const css = fontsCss([inter], "/fonts/p1");
    expect(css).toContain('font-family:"Inter"');
    expect(css).toContain('url("/fonts/p1/inter/latin-400-normal.woff2") format("woff2")');
    expect(css).toContain("unicode-range:U+0000-00FF,U+0131;");
    expect(css).toContain("font-weight:100 900;");
    expect(css).toContain("font-display:swap");
  });

  it("skips inactive fonts", () => {
    expect(fontsCss([{ ...inter, active: false }], "/fonts/p1")).toBe("");
  });

  it("refuses families that could break out of the string", () => {
    expect(fontsCss([{ ...inter, family: 'x"};body{' }], "/f")).toBe("");
    expect(fontListSchema.safeParse([{ ...inter, family: 'x"}' }]).success).toBe(false);
  });
});

describe("fonts model", () => {
  it("rejects duplicate families", () => {
    expect(fontListSchema.safeParse([inter, { ...inter, id: "inter-2" }]).success).toBe(false);
  });

  it("builds a stack with a generic fallback", () => {
    expect(fontStack(inter)).toBe('"Inter", sans-serif');
  });

  it("preloads only the latin normal files of preloaded active fonts", () => {
    expect(fontPreloads([inter], "/fonts/p1")).toEqual([
      { href: "/fonts/p1/inter/latin-400-normal.woff2", type: "font/woff2" }
    ]);
    expect(fontPreloads([{ ...inter, preload: false }], "/fonts/p1")).toEqual([]);
  });

  it("totals the weight of active fonts", () => {
    expect(fontWeight([inter, { ...inter, id: "x", family: "X", active: false }])).toEqual({
      files: 2,
      bytes: 50000
    });
  });
});

describe("sniffFontFormat", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(12).fill(0)]);
  it("reads magic bytes", () => {
    expect(sniffFontFormat(bytes(0x77, 0x4f, 0x46, 0x32))).toBe("woff2");
    expect(sniffFontFormat(bytes(0x77, 0x4f, 0x46, 0x46))).toBe("woff");
    expect(sniffFontFormat(bytes(0x4f, 0x54, 0x54, 0x4f))).toBe("otf");
    expect(sniffFontFormat(bytes(0, 1, 0, 0))).toBe("ttf");
  });
  it("refuses anything else", () => {
    expect(sniffFontFormat(new TextEncoder().encode("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(sniffFontFormat(new Uint8Array(3))).toBeNull();
  });
});

describe("usage", () => {
  it("finds the family in lists, quoted or bare, not as a substring of another", () => {
    expect(mentionsFamily('"Inter", sans-serif', "Inter")).toBe(true);
    expect(mentionsFamily("Inter, Arial", "Inter")).toBe(true);
    expect(mentionsFamily('"Inter Tight", sans-serif', "Inter")).toBe(false);
  });

  it("counts a style map once", () => {
    expect(
      countFamilyInStyles(
        { breakpoints: { base: { default: { "font-family": '"Inter", sans-serif' } } } },
        "Inter"
      )
    ).toBe(1);
  });
});

describe("font rights", () => {
  it("writes nothing for a font whose use is not confirmed", () => {
    const font = { ...inter, source: "upload" as const, rights: false };
    expect(fontsCss([font], "/fonts/p")).toBe("");
    expect(fontPreloads([font], "/fonts/p")).toEqual([]);
    expect(fontWeight([font])).toEqual({ files: 0, bytes: 0 });
    expect(fontsCss([{ ...font, rights: true }], "/fonts/p")).toContain("@font-face");
  });
});
