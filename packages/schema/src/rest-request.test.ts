import { describe, expect, it } from "vitest";
import { newRestCall, newRestGroup, restVariableSchema, type RestCall } from "./rest";
import { previewRequest } from "./rest-request";

const variable = (name: string, patch: object = {}) =>
  restVariableSchema.parse({ id: name, name, ...patch });

describe("request preview", () => {
  const group = {
    ...newRestGroup("g1", "Main"),
    baseUrl: "https://api.example.com/[version]",
    headers: [{ key: "X-App", value: "nextomic" }],
    variables: [variable("version", { defaultValue: "v1" })],
    auth: { type: "apiKey" as const, username: "", apiKeyName: "key", apiKeyIn: "query" as const }
  };
  const call: RestCall = {
    ...newRestCall("c1", "g1", "Search"),
    method: "POST",
    url: "/search?fixed=1",
    query: [{ key: "q", value: "[term]" }],
    headers: [{ key: "Authorization", value: "Bearer [jwt]" }],
    bodyType: "json",
    body: '{"a": 1}',
    variables: [variable("term", { defaultValue: "x y" })]
  };

  it("shows the URL with query parameters and masked secrets before any test", () => {
    const preview = previewRequest({
      call,
      group,
      values: {},
      builtIns: { jwt: "eyJ.sample.token", user_ip: "" },
      hasSecret: (owner, field) => owner === "g1" && field === "apiKey"
    });
    expect(preview.url).toBe("https://api.example.com/v1/search?fixed=1&q=x+y&key=••••");
    expect(preview.headers).toEqual({
      "x-app": "nextomic",
      authorization: "Bearer ••••",
      "content-type": "application/json"
    });
  });

  it("shows a partial URL while it is still being typed", () => {
    const preview = previewRequest({
      call: { ...call, groupId: null, url: "/[term]" },
      group: null,
      values: { term: "a" },
      builtIns: { jwt: "", user_ip: "" },
      hasSecret: () => false
    });
    expect(preview.url).toBe("/a?q=a");
  });
});
