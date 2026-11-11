import { describe, expect, it } from "vitest";
import { mapUrl } from "./browser-actions";
import { ElementEditStore } from "./html-props";

describe("ElementEditStore", () => {
  it("keeps the last class change per name", () => {
    const store = new ElementEditStore();
    store.addClass("a", "open");
    store.removeClass("a", "open");
    store.addClass("a", "wide");
    store.setId("a", null);
    store.setAttribute("a", "title", "Hi");
    expect(store.snapshot()).toEqual({
      a: {
        addClasses: ["wide"],
        removeClasses: ["open"],
        htmlId: null,
        attributes: { title: "Hi" }
      }
    });
  });

  it("stops at 200 edited elements", () => {
    const store = new ElementEditStore();
    for (let i = 0; i < 200; i += 1) store.addClass(`n${i}`, "x");
    expect(() => store.addClass("extra", "x")).toThrow("Too many");
  });
});

describe("mapUrl", () => {
  it("builds provider links for addresses and coordinates", () => {
    expect(mapUrl({ mode: "address", address: "1 Main St", provider: "google" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=1%20Main%20St"
    );
    expect(mapUrl({ mode: "address", address: "Rome", provider: "apple" })).toBe(
      "https://maps.apple.com/?q=Rome"
    );
    expect(
      mapUrl({ mode: "coordinates", latitude: "41.9", longitude: "12.5", provider: "osm" })
    ).toBe("https://www.openstreetmap.org/?mlat=41.9&mlon=12.5#map=16/41.9/12.5");
  });

  it("refuses an empty address and out-of-range coordinates", () => {
    expect(() => mapUrl({ mode: "address", address: " " })).toThrow("address");
    expect(() => mapUrl({ mode: "coordinates", latitude: "91", longitude: "0" })).toThrow(
      "Latitude"
    );
  });
});
