import { describe, expect, it } from "vitest";
import { buildDynamicContext, createTokenResolver } from "./dynamic-context";
import { defaultPageSettings, pageSettingsSchema } from "./page";

const settings = pageSettingsSchema.parse({
  params: [
    { name: "slug", defaultValue: "hello" },
    { name: "id", defaultValue: "1" }
  ],
  state: [
    { name: "count", type: "integer", defaultValue: 3 },
    { name: "data", type: "json", defaultValue: '{"a":{"b":[10,20]},"name":"Ann"}' }
  ]
});

function resolver(extra: Parameters<typeof buildDynamicContext>[0]["paramValues"] = {}) {
  return createTokenResolver(
    buildDynamicContext({
      page: { name: "About", route: "/about", settings },
      mode: "preview",
      paramValues: extra,
      query: "x=1",
      origin: "https://site.test",
      nowIso: "2026-03-09T23:30:45.000Z",
      timeZone: "UTC"
    })
  );
}

describe("token resolver", () => {
  it("resolves page, request and environment tags", () => {
    const r = resolver();
    expect(r("page.name")).toBe("About");
    expect(r("page.route")).toBe("/about");
    expect(r("request.url")).toBe("https://site.test/about?x=1");
    expect(r("request.path")).toBe("/about");
    expect(r("request.query")).toBe("x=1");
    expect(r("env.mode")).toBe("preview");
  });

  it("resolves date and time in the chosen time zone", () => {
    const r = resolver();
    expect(r("now.iso")).toBe("2026-03-09T23:30:45.000Z");
    expect(r("now.date")).toBe("2026-03-09");
    expect(r("now.time")).toBe("23:30:45");
    expect(r("now.year")).toBe("2026");
    const tokyo = createTokenResolver(
      buildDynamicContext({
        page: { name: "A", route: "/", settings: defaultPageSettings() },
        mode: "editor",
        nowIso: "2026-03-09T23:30:45.000Z",
        timeZone: "Asia/Tokyo"
      })
    );
    expect(tokyo("now.date")).toBe("2026-03-10");
    expect(tokyo("now.time")).toBe("08:30:45");
  });

  it("uses parameter defaults and overrides", () => {
    expect(resolver()("param.slug")).toBe("hello");
    expect(resolver({ slug: "world" })("param.slug")).toBe("world");
    expect(resolver()("param.missing")).toBe("");
  });

  it("resolves state values and paths into json", () => {
    const r = resolver();
    expect(r("state.count")).toBe("3");
    expect(r("state.data.name")).toBe("Ann");
    expect(r("state.data.a.b.1")).toBe("20");
    expect(r("state.data.nope.deeper")).toBe("");
  });

  it("gives empty text for unknown tags and signed-out users", () => {
    const r = resolver();
    expect(r("nope.thing")).toBe("");
    expect(r("user.email")).toBe("");
    expect(r("garbage")).toBe("");
  });
});
