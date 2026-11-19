import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({ getStorageAdapter: () => ({}) }));

import { MediaError, prepareUpload, takeMediaWrite } from "./media";

const text = (s: string) => new TextEncoder().encode(s);
const png = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...new Array(24).fill(0)
]);

const ID = "a1b2c3d4-e5f6-4718-893a-4b5c6d7e8f90";
const prepare = (name: string, data: Uint8Array) => prepareUpload(name, data, ID);

describe("prepareUpload", () => {
  it("keeps the uploaded name and takes the extension from the bytes", () => {
    const out = prepare("Holiday Photo.exe", png);
    expect(out.format.mime).toBe("image/png");
    expect(out.fileName).toBe("Holiday Photo.png");
  });

  it("falls back to the asset id when the name cannot be kept", () => {
    expect(prepare("日本語.png", png).fileName).toBe(`${ID}.png`);
    expect(prepare(".png", png).fileName).toBe(`${ID}.png`);
  });

  it("refuses HTML and scripts even when named .png", () => {
    expect(() => prepare("a.png", text("<!DOCTYPE html><script>alert(1)</script>"))).toThrow(
      /HTML and script/
    );
    expect(() => prepare("a.svg", text("<html><body>x</body></html>"))).toThrow(MediaError);
  });

  it("refuses empty and unknown files", () => {
    expect(() => prepare("a.png", new Uint8Array())).toThrow(/empty/);
    expect(() => prepare("a.bin", text("plain text file contents"))).toThrow(/not supported/);
  });

  it("stores sanitized SVG only", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect onclick="x()" width="3"/></svg>';
    const out = prepare("icon.svg", text(svg));
    const body = new TextDecoder().decode(out.data);
    expect(out.format.kind).toBe("svg");
    expect(body).not.toMatch(/script|onclick/);
    expect(body).toContain('width="3"');
  });

  it("refuses an SVG with a DOCTYPE or broken markup", () => {
    expect(() => prepare("a.svg", text('<!DOCTYPE svg [<!ENTITY x "y">]><svg/>'))).toThrow(
      /DOCTYPE/
    );
    expect(() => prepare("a.svg", text("<svg><g></svg>"))).toThrow(/not a valid SVG/);
  });

  it("enforces the size cap of the kind", () => {
    const svg = text(
      `<svg xmlns="http://www.w3.org/2000/svg"><title>${"a".repeat(3 * 1024 * 1024)}</title></svg>`
    );
    expect(() => prepare("big.svg", svg)).toThrow(/limit/);
  });
});

describe("takeMediaWrite", () => {
  it("stops a user who writes too fast", () => {
    let blocked = false;
    for (let i = 0; i < 300; i++) {
      try {
        takeMediaWrite("rate-user", "upload");
      } catch (error) {
        blocked = error instanceof MediaError;
        break;
      }
    }
    expect(blocked).toBe(true);
  });
});
