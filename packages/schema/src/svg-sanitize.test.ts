import { describe, expect, it } from "vitest";
import { sanitizeSvg, SvgError } from "./svg-sanitize";

const wrap = (inner: string, attrs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

describe("sanitizeSvg", () => {
  it("keeps drawing markup", () => {
    const out = sanitizeSvg(
      wrap(
        '<g fill="red"><path d="M0 0L10 10"/><circle cx="5" cy="5" r="2"/></g><linearGradient id="a"><stop offset="0"/></linearGradient>',
        'viewBox="0 0 10 10"'
      )
    );
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('<path d="M0 0L10 10"/>');
    expect(out).toContain("<linearGradient");
  });
  it("drops script elements and their content", () => {
    const out = sanitizeSvg(wrap("<script>alert(1)</script><rect/>"));
    expect(out).not.toMatch(/script|alert/i);
    expect(out).toContain("<rect/>");
  });
  it("drops foreignObject with its HTML", () => {
    expect(
      sanitizeSvg(wrap("<foreignObject><div onclick='x'>hi</div></foreignObject>"))
    ).not.toMatch(/foreignObject|div|hi/);
  });
  it("drops event handler attributes", () => {
    const out = sanitizeSvg(wrap('<rect onload="x()" onclick="y()" width="3"/>'));
    expect(out).not.toMatch(/on(load|click)/i);
    expect(out).toContain('width="3"');
  });
  it("drops javascript: and data: links", () => {
    expect(sanitizeSvg(wrap('<use href="javascript:alert(1)"/>'))).not.toMatch(/javascript/);
    expect(sanitizeSvg(wrap('<use xlink:href="data:text/html;base64,AAA"/>'))).not.toMatch(/data:/);
    expect(sanitizeSvg(wrap('<use href="java&#x73;cript:alert(1)"/>'))).not.toMatch(/script/i);
    expect(sanitizeSvg(wrap('<rect fill="jav\tascript:x"/>'))).not.toMatch(/fill=/);
  });
  it("keeps only same-document <use> references", () => {
    expect(sanitizeSvg(wrap('<use href="#a"/>'))).toContain('href="#a"');
    expect(sanitizeSvg(wrap('<use href="https://evil.test/x.svg#a"/>'))).not.toContain("evil");
  });
  it("drops external url() in attributes and styles", () => {
    expect(sanitizeSvg(wrap('<rect fill="url(https://evil.test/x)"/>'))).not.toContain("evil");
    expect(sanitizeSvg(wrap('<rect style="fill:url(//evil.test)"/>'))).not.toContain("evil");
    expect(sanitizeSvg(wrap('<rect fill="url(#grad)"/>'))).toContain("url(#grad)");
  });
  it("drops @import and other unsafe CSS but keeps plain CSS", () => {
    expect(sanitizeSvg(wrap("<style>@import url(https://evil.test/a.css);</style>"))).not.toContain(
      "evil"
    );
    expect(sanitizeSvg(wrap("<style>.a{fill:red}</style>"))).toContain(".a{fill:red}");
    expect(sanitizeSvg(wrap("<style>.a{background:url(//x.test/y)}</style>"))).not.toContain(
      "x.test"
    );
  });
  it("drops animation, links and embedded images", () => {
    const out = sanitizeSvg(
      wrap(
        '<a href="https://x.test"><rect/></a><animate attributeName="href" to="javascript:x"/><image href="https://x.test/a.png"/>'
      )
    );
    expect(out).not.toMatch(/<a|animate|image|x\.test/);
  });
  it("refuses DOCTYPE and ENTITY (XXE, billion laughs)", () => {
    expect(() =>
      sanitizeSvg('<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"/>')
    ).toThrow(SvgError);
    expect(() =>
      sanitizeSvg('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd"><svg/>')
    ).toThrow(SvgError);
  });
  it("refuses broken markup, non-svg roots and extra roots", () => {
    for (const bad of [
      "<svg>",
      "<svg></g></svg>",
      "<html></html>",
      "<svg/><svg/>",
      "hello",
      "<svg a=b/>",
      "<svg><rect a='1' a='2'/></svg>"
    ])
      expect(() => sanitizeSvg(bad)).toThrow(SvgError);
  });
  it("removes comments, processing instructions and unknown elements", () => {
    const out = sanitizeSvg(
      '<?xml version="1.0"?><!-- hi --><svg><blink>x<rect/></blink><rect id="k"/></svg>'
    );
    expect(out).not.toMatch(/xml|hi|blink|x</);
    expect(out).toContain('<rect id="k"/>');
  });
  it("escapes text and attribute values", () => {
    const out = sanitizeSvg(
      wrap('<text>a &lt; b &amp; c</text><title>"q"</title>', 'aria-label="x&quot;y"')
    );
    expect(out).toContain("a &lt; b &amp; c");
    expect(out).toContain('aria-label="x&quot;y"');
  });
  it("limits nesting depth", () => {
    expect(() => sanitizeSvg(wrap("<g>".repeat(100) + "</g>".repeat(100)))).toThrow(SvgError);
  });
});
