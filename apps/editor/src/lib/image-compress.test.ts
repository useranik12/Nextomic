import { describe, expect, it } from "vitest";
import { canConvert, isHeicFile, webpName } from "./image-compress";

const f = (name: string, type: string) => ({ name, type });

describe("image-compress helpers", () => {
  it("knows HEIC by type or by extension", () => {
    expect(isHeicFile(f("IMG_1.HEIC", ""))).toBe(true);
    expect(isHeicFile(f("a.jpg", "image/heif"))).toBe(true);
    expect(isHeicFile(f("a.jpg", "image/jpeg"))).toBe(false);
  });

  it("converts stills but leaves SVG, GIF and non-images alone", () => {
    expect(canConvert(f("a.png", "image/png"))).toBe(true);
    expect(canConvert(f("a.jpg", "image/jpeg"))).toBe(true);
    expect(canConvert(f("a.heic", "image/heic"))).toBe(true);
    expect(canConvert(f("a.svg", "image/svg+xml"))).toBe(false);
    expect(canConvert(f("a.gif", "image/gif"))).toBe(false);
    expect(canConvert(f("a.gif", "image/gif"), { includeGif: true })).toBe(true);
    expect(canConvert(f("a.pdf", "application/pdf"))).toBe(false);
    expect(canConvert(f("noext", ""))).toBe(false);
  });

  it("names the result with a .webp extension", () => {
    expect(webpName("Team Photo.PNG")).toBe("Team Photo.webp");
    expect(webpName("a.b.jpeg")).toBe("a.b.webp");
    expect(webpName("noext")).toBe("noext.webp");
  });
});
