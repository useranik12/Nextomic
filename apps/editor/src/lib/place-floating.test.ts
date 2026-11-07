import { describe, expect, it } from "vitest";
import { placeBeside, placeFloating } from "./place-floating";

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

  it("can prefer below", () => {
    const p = placeFloating({ left: 500, top: 400, width: 40, height: 40 }, size, viewport, {
      prefer: "bottom"
    });
    expect(p.side).toBe("bottom");
  });

  it("goes below when there is no room above", () => {
    const p = placeFloating({ left: 500, top: 10, width: 40, height: 30 }, size, viewport);
    expect(p.side).toBe("bottom");
    expect(p.top).toBe(46);
  });
});

describe("placeBeside", () => {
  const panel = { width: 300, height: 200 };
  it("goes to the side with more room, top-aligned", () => {
    const p = placeBeside({ left: 800, top: 100, width: 150, height: 30 }, panel, viewport);
    expect(p).toEqual({ side: "left", left: 492, top: 100 });
    const q = placeBeside({ left: 50, top: 100, width: 150, height: 30 }, panel, viewport);
    expect(q).toEqual({ side: "right", left: 208, top: 100 });
  });

  it("stays inside the bottom edge", () => {
    const p = placeBeside({ left: 800, top: 700, width: 150, height: 30 }, panel, viewport);
    expect(p.top).toBe(592);
  });

  it("falls back to below when no side fits", () => {
    const p = placeBeside({ left: 300, top: 100, width: 400, height: 30 }, panel, viewport);
    expect(p.side).toBe("bottom");
  });
});
