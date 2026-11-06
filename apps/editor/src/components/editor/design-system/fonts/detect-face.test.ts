import { describe, expect, it } from "vitest";
import { detectFaceFromBytes, detectFaceFromName } from "./detect-face";

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

function sfnt(weightClass: number, italic: boolean, axis?: [number, number]): Uint8Array {
  const tables = axis ? 2 : 1;
  const buf = new Uint8Array(12 + tables * 16 + 70 + (axis ? 40 : 0));
  const v = new DataView(buf.buffer);
  v.setUint32(0, 0x00010000);
  v.setUint16(4, tables);
  const os2 = 12 + tables * 16;
  buf.set(ascii("OS/2"), 12);
  v.setUint32(12 + 8, os2);
  v.setUint16(os2 + 4, weightClass);
  v.setUint16(os2 + 62, italic ? 1 : 0);
  if (axis) {
    const fvar = os2 + 70;
    buf.set(ascii("fvar"), 28);
    v.setUint32(28 + 8, fvar);
    v.setUint16(fvar + 4, 16);
    v.setUint16(fvar + 8, 1);
    v.setUint16(fvar + 10, 20);
    buf.set(ascii("wght"), fvar + 16);
    v.setInt32(fvar + 20, axis[0] * 65536);
    v.setInt32(fvar + 24, 400 * 65536);
    v.setInt32(fvar + 28, axis[1] * 65536);
  }
  return buf;
}

describe("reading a face from a file", () => {
  it("reads weight and style from the file name", () => {
    expect(detectFaceFromName("Satoshi-Light.woff2")).toEqual({ weight: 300, style: "normal" });
    expect(detectFaceFromName("Satoshi-MediumItalic.woff2")).toEqual({
      weight: 500,
      style: "italic"
    });
    expect(detectFaceFromName("Satoshi-Regular.woff2").weight).toBe(400);
    expect(detectFaceFromName("Inter-ExtraBold.ttf").weight).toBe(800);
    expect(detectFaceFromName("Inter-SemiBold.ttf").weight).toBe(600);
    expect(detectFaceFromName("Inter-ExtraLight.ttf").weight).toBe(200);
    expect(detectFaceFromName("Inter-Black.ttf").weight).toBe(900);
    expect(detectFaceFromName("Inter-Bold.ttf").weight).toBe(700);
    expect(detectFaceFromName("Inter-700.woff2").weight).toBe(700);
    expect(detectFaceFromName("Inter-Variable.woff2")).toEqual({
      weight: 100,
      weightMax: 900,
      style: "normal"
    });
  });

  it("reads the OS/2 weight and italic bit of a TrueType file", () => {
    expect(detectFaceFromBytes(sfnt(700, true))).toEqual({ weight: 700, style: "italic" });
  });

  it("reads the wght axis of a variable TrueType file", () => {
    expect(detectFaceFromBytes(sfnt(400, false, [200, 800]))).toEqual({
      weight: 200,
      weightMax: 800,
      style: "normal"
    });
  });

  it("returns null for compressed woff files", () => {
    expect(
      detectFaceFromBytes(new Uint8Array([...ascii("wOF2"), 0, 0, 0, 0, 0, 0, 0, 0]))
    ).toBeNull();
  });
});
