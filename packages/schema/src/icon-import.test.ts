import { describe, expect, it } from "vitest";
import { iconSvg } from "./icon-render";
import {
  glyphMap,
  IconImportError,
  normalizeIconifySet,
  parseFontello,
  parseIcoMoon,
  parseIconFontCss,
  slugIconName,
  svgToIcon
} from "./icon-import";
import { glyphChar, iconFontFaceCss, iconFontGlyphCss } from "./icons";

describe("names and glyph maps", () => {
  it("slugs names", () => {
    expect(slugIconName("Arrow Left (v2)!")).toBe("arrow-left-v2");
    expect(slugIconName("Ünïcode")).toBe("unicode");
    expect(slugIconName("---")).toBe("");
  });
  it("keeps valid glyphs, numbers duplicates and drops bad names and codepoints", () => {
    const map = glyphMap([
      { name: "Home", code: 0xe900 },
      { name: "home", code: 0xe901 },
      { name: "", code: 0xe902 },
      { name: "ctrl", code: 0x0a },
      { name: "surrogate", code: 0xd800 },
      { name: "huge", code: 0x110000 },
      { name: "frac", code: 1.5 }
    ]);
    expect(map).toEqual({ home: "e900", "home-2": "e901" });
  });
});

describe("IcoMoon and Fontello", () => {
  it("reads IcoMoon selection.json, taking the first of several names", () => {
    const glyphs = parseIcoMoon({
      icons: [
        { properties: { name: "home, house", code: 59648 } },
        { properties: { name: "star", code: 59649 } },
        { properties: { code: 59650 } }
      ],
      metadata: { name: "x" }
    });
    expect(glyphs).toEqual([
      { name: "home", code: 59648 },
      { name: "star", code: 59649 }
    ]);
  });
  it("reads Fontello config.json", () => {
    expect(
      parseFontello({ name: "f", glyphs: [{ uid: "a", css: "home", code: 59392, src: "x" }] })
    ).toEqual([{ name: "home", code: 59392 }]);
  });
  it("refuses the wrong file", () => {
    expect(() => parseIcoMoon({ glyphs: [] })).toThrow(IconImportError);
    expect(() => parseFontello({ icons: [] })).toThrow(IconImportError);
  });
});

describe("parseIconFontCss", () => {
  const css = `
    @font-face { font-family: "x"; src: url(x.woff2); }
    [class^="icon-"], [class*=" icon-"] { font-family: x; }
    .icon-home:before { content: "\\e900"; }
    .icon-star::before, .icon-fav:before { content: "\\e901"; }
    .icon-literal:before { content: ""; }
    .icon-ligature:before { content: "ab"; }
    .icon-doubled:before { content: "\\\\e903"; }
    .not-an-icon { color: red; }
  `;
  it("maps classes to codepoints and strips the shared prefix", () => {
    expect(parseIconFontCss(css)).toEqual([
      { name: "home", code: 0xe900 },
      { name: "star", code: 0xe901 },
      { name: "fav", code: 0xe901 },
      { name: "literal", code: 0xe902 },
      { name: "doubled", code: 0xe903 }
    ]);
  });
  it("keeps full names when no prefix is shared and rejects unreadable CSS", () => {
    expect(
      parseIconFontCss('.alpha:before{content:"\\e900"} .beta:before{content:"\\e901"}').map(
        (g) => g.name
      )
    ).toEqual(["alpha", "beta"]);
    expect(() => parseIconFontCss("a { color: ")).toThrow(IconImportError);
  });
});

describe("svgToIcon", () => {
  const svg = (inner: string, attrs = 'viewBox="0 0 24 24"') =>
    `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

  it("moves root drawing attributes onto the body and recolors to currentColor", () => {
    const icon = svgToIcon(
      svg(
        '<path d="M0 0" stroke="#ff0000" fill="#00ff00"/>',
        'viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2"'
      ),
      false
    );
    expect(icon).toMatchObject({ width: 24, height: 24 });
    expect(icon.body).toContain('<g fill="none"');
    expect(icon.body).toContain('stroke-width="2"');
    expect(icon.body).not.toMatch(/#ff0000|#00ff00|black/);
    expect(icon.body).toContain('stroke="currentColor"');
  });
  it("gives a plain shape the text color", () => {
    expect(svgToIcon(svg('<path d="M0 0"/>'), false).body).toContain('fill="currentColor"');
  });
  it("keeps original colors on request and keeps gradients when recoloring", () => {
    expect(svgToIcon(svg('<path fill="#ff0000" d="M0 0"/>'), true).body).toContain("#ff0000");
    const grad = svgToIcon(svg('<path fill="url(#g)" d="M0 0"/>'), false).body;
    expect(grad).toContain("url(#g)");
  });
  it("recolors inline style fills", () => {
    expect(
      svgToIcon(svg('<path style="fill:#123456;opacity:.5" d="M0 0"/>'), false).body
    ).toContain("fill:currentColor");
  });
  it("uses width and height without a viewBox and keeps a viewBox origin", () => {
    expect(svgToIcon(svg("<path/>", 'width="16px" height="8"'), true)).toMatchObject({
      width: 16,
      height: 8
    });
    expect(svgToIcon(svg("<path/>", 'viewBox="-2 -3 10 10"'), true)).toMatchObject({
      left: -2,
      top: -3,
      width: 10
    });
  });
  it("refuses a file with no size, no drawing, scripts only or no SVG at all", () => {
    expect(() => svgToIcon(svg("<path/>", ""), true)).toThrow(/viewBox/);
    expect(() => svgToIcon(svg(""), true)).toThrow(/no drawing/);
    expect(() => svgToIcon(svg("<script>alert(1)</script>"), true)).toThrow(/no drawing/);
    expect(() => svgToIcon("<html></html>", true)).toThrow(IconImportError);
  });
  it("sanitizes: handlers removed, animation kept, result renders as an icon", () => {
    const icon = svgToIcon(
      svg(
        '<rect onclick="x()" width="4" height="4"><animate attributeName="width" to="8" dur="1s"/></rect>'
      ),
      true
    );
    expect(icon.body).not.toContain("onclick");
    expect(icon.body).toContain("<animate");
    const out = iconSvg({ icons: { a: icon } }, "a");
    expect(out).toContain("<rect");
  });
});

describe("normalizeIconifySet", () => {
  const raw = {
    prefix: "whatever",
    width: 24,
    height: 24,
    icons: {
      ok: { body: '<path d="M0 0"/>' },
      "Bad Name": { body: "<path/>" },
      evil: { body: "<script>alert(1)</script>" }
    },
    aliases: { good: { parent: "ok" }, orphan: { parent: "nope" } }
  };
  it("re-prefixes, keeps safe icons and counts what it dropped", () => {
    const { set, skipped } = normalizeIconifySet(raw, "mine");
    expect(set.prefix).toBe("mine");
    expect(Object.keys(set.icons)).toEqual(["ok"]);
    expect(Object.keys(set.aliases ?? {})).toEqual(["good"]);
    expect(skipped).toBe(3);
  });
  it("refuses data that is not an icon set or has nothing usable", () => {
    expect(() => normalizeIconifySet({ nope: 1 }, "mine")).toThrow(IconImportError);
    expect(() =>
      normalizeIconifySet({ prefix: "x", icons: { "Bad Name": { body: "<path/>" } } }, "mine")
    ).toThrow(/No usable/);
  });
});

describe("icon font CSS", () => {
  it("writes our own @font-face and glyph rules", () => {
    const face = iconFontFaceCss(
      {
        key: "my-font",
        fontFiles: [
          { file: "my-font-aaaaaaaa.ttf", format: "ttf", bytes: 1, sha256: "a".repeat(64) },
          { file: "my-font-bbbbbbbb.woff2", format: "woff2", bytes: 1, sha256: "b".repeat(64) }
        ]
      },
      "/icons/p1"
    );
    expect(face).toContain('font-family:"nxt-my-font"');
    // woff2 comes first, then ttf.
    expect(face.indexOf("woff2")).toBeLessThan(face.indexOf("truetype"));
    expect(face).toContain("url(/icons/p1/my-font-bbbbbbbb.woff2)");
    expect(iconFontGlyphCss("my-font", { home: "e900" })).toBe(
      '.nxt-my-font-home::before{content:"\\e900"}'
    );
    expect(glyphChar("e900")).toBe("");
  });
});
