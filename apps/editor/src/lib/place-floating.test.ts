import { describe, expect, it } from "vitest";
import { placeFloating } from "./place-floating";

const viewport = { width: 1000, height: 800 };
const size = { width: 120, height: 30 };

describe("placeFloating", () => {
  it("centers above the anchor when there is room", () => {
    const p = placeFloating({ left: 500, top: 400, width: 40, height: 40 }, size, viewport);
    expect(p).toEqual({ side: "top", left: 460, top: 364 });
  });

  it("stays inside the left edge for an anchor at the screen edge", () => {
    const p = placeFloating({ left: 4, top: 400, width: 40, height: 40 }, size, viewport);
    expect(p.left).toBe(8);
  });

  it("stays inside the right edge", () => {
    const p = placeFloating({ left: 980, top: 400, width: 20, height: 20 }, size, viewport);
    expect(p.left + size.width).toBeLessThanOrEqual(992);
  });

  it("goes below when there is no room above", () => {
    const p = placeFloating({ left: 500, top: 10, width: 40, height: 30 }, size, viewport);
    expect(p.side).toBe("bottom");
    expect(p.top).toBe(46);
  });
});
