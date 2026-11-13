import { describe, expect, it } from "vitest";
import { ICON_CATALOG } from "./icon-catalog.generated";
import { iconSvg, sampleSvg } from "./icon-render";
import { iconLibraryListSchema, iconifyNames, iconifySetSchema, type IconifySet } from "./icons";
import { sanitizeSvg } from "./svg-sanitize";

const set = (): IconifySet =>
  iconifySetSchema.parse({
    prefix: "t",
    width: 24,
    height: 24,
    icons: {
      home: { body: '<path d="M0 0h24v24H0z"/>' },
      wide: { body: '<path d="M0 0h32v16H0z"/>', width: 32, height: 16 },
      spin: {
        body: '<path d="M12 2a10 10 0 0 1 10 10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path>'
      },
      evil: {
        body: '<path d="M0 0" onload="x()"/><animate attributeName="href" to="javascript:alert(1)"/><script>alert(1)</script>'
      }
    },
    aliases: { house: { parent: "home" }, flipped: { parent: "home", hFlip: true } }
  });

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

describe("iconSvg", () => {
  it("draws an icon at 1em with a viewBox and is decorative by default", () => {
    const svg = iconSvg(set(), "home")!;
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('height="1em"');
    expect(svg).toContain('aria-hidden="true"');
  });
  it("keeps a non-square ratio", () => {
    expect(iconSvg(set(), "wide")!).toContain('viewBox="0 0 32 16"');
  });
  it("resolves aliases and flips", () => {
    expect(iconSvg(set(), "house")).toContain("<path");
    expect(iconSvg(set(), "flipped")).toContain("scale(-1 1)");
  });
  it("labels a meaningful icon", () => {
    const svg = iconSvg(set(), "home", { label: 'Home "page"' })!;
    expect(svg).toContain('role="img"');
    expect(svg).toContain("aria-label=");
    expect(svg).not.toContain("aria-hidden");
  });
  it("returns null for a missing icon and ignores an unsafe size", () => {
    expect(iconSvg(set(), "nope")).toBeNull();
    expect(iconSvg(set(), "home", { size: "1em;x:y" })).toContain('height="1em"');
  });
  it("keeps animated icons moving", () => {
    expect(iconSvg(set(), "spin")).toContain("<animateTransform");
  });
  it("drops scripts, handlers and animations that rewrite links", () => {
    const svg = iconSvg(set(), "evil")!;
    expect(svg).not.toMatch(/script|alert|onload|<animate/i);
  });
});

describe("sanitizeSvg animation mode", () => {
  const anim = '<rect width="4"><animate attributeName="width" from="0" to="4" dur="1s"/></rect>';
  it("drops SMIL by default (media uploads)", () => {
    expect(sanitizeSvg(wrap(anim))).not.toContain("<animate");
  });
  it("keeps safe SMIL in icon mode", () => {
    expect(sanitizeSvg(wrap(anim), { animations: true })).toContain("<animate");
  });
  it.each(["href", "xlink:href", "onbegin", "ONLOAD"])(
    "drops an animation that targets %s",
    (target) => {
      const bad = `<rect><set attributeName="${target}" to="javascript:alert(1)"/></rect>`;
      const out = sanitizeSvg(wrap(bad), { animations: true });
      expect(out).not.toMatch(/<set|javascript/i);
    }
  );
  it("still blocks javascript: values inside kept animations", () => {
    const out = sanitizeSvg(
      wrap('<rect><animate attributeName="fill" to="url(javascript:x)" dur="1s"/></rect>'),
      { animations: true }
    );
    expect(out).not.toMatch(/javascript/i);
  });
});

describe("iconifySetSchema", () => {
  it("lists icons and aliases", () => {
    expect(iconifyNames(set())).toEqual(["evil", "flipped", "home", "house", "spin", "wide"]);
  });
  it("rejects a set without icons", () => {
    expect(iconifySetSchema.safeParse({ prefix: "x" }).success).toBe(false);
  });
});

describe("icon library list", () => {
  const lib = {
    key: "ph",
    name: "Phosphor",
    source: "iconify",
    count: 1,
    bytes: 10,
    sha256: "a".repeat(64),
    file: "ph-aaaaaaaa.json"
  };
  it("accepts a library and fills defaults", () => {
    const [parsed] = iconLibraryListSchema.parse([lib]);
    expect(parsed).toMatchObject({ mode: "svg", enabled: true, requiresAttribution: false });
  });
  it("rejects duplicate keys and bad keys", () => {
    expect(iconLibraryListSchema.safeParse([lib, lib]).success).toBe(false);
    expect(iconLibraryListSchema.safeParse([{ ...lib, key: "Bad Key" }]).success).toBe(false);
  });
});

describe("icon catalog", () => {
  it("has unique prefixes and no non-commercial license", () => {
    expect(new Set(ICON_CATALOG.map((c) => c.prefix)).size).toBe(ICON_CATALOG.length);
    expect(ICON_CATALOG.some((c) => /(^|-)NC(-|$)/i.test(c.licenseSpdx))).toBe(false);
    expect(ICON_CATALOG.find((c) => c.prefix === "cbi")).toBeUndefined();
  });
  it("flags CC BY sets for attribution and includes the animated sets", () => {
    for (const c of ICON_CATALOG)
      expect(c.requiresAttribution).toBe(/^CC-BY(-|$)/.test(c.licenseSpdx));
    expect(ICON_CATALOG.filter((c) => c.animated).map((c) => c.prefix)).toEqual([
      "svg-spinners",
      "line-md"
    ]);
  });
  it("renders every preview icon safely", () => {
    for (const c of ICON_CATALOG) {
      expect(c.samples.length).toBeGreaterThan(0);
      for (const s of c.samples) expect(sampleSvg(s), `${c.prefix}/${s.name}`).toContain("<svg");
    }
  });
});
