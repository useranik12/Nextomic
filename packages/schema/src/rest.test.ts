import { describe, expect, it } from "vitest";
import {
  callProblems,
  fillBrackets,
  fillJsonBody,
  formatJsonBody,
  jsonBodyProblem,
  joinUrl,
  newRestCall,
  newRestGroup,
  parseHeaderLine,
  restConfigSchema,
  restVariableSchema,
  variableValue,
  type RestCall
} from "./rest";

const call = (patch: Partial<RestCall>): RestCall => ({
  ...newRestCall("c1", "g1", "Get"),
  ...patch
});
const variable = (name: string, patch: object = {}) =>
  restVariableSchema.parse({ id: name, name, ...patch });

describe("rest config", () => {
  it("fills defaults and refuses unknown methods", () => {
    const config = restConfigSchema.parse({ calls: [{ id: "a", name: "A" }] });
    expect(config.calls[0]).toMatchObject({
      method: "GET",
      active: true,
      groupId: null,
      bodyType: "none"
    });
    expect(
      restConfigSchema.safeParse({ calls: [{ id: "a", name: "A", method: "TRACE" }] }).success
    ).toBe(false);
    expect(
      restConfigSchema.parse({ calls: [{ id: "a", name: "A", method: "QUERY" }] }).calls[0]?.method
    ).toBe("QUERY");
  });

  it("refuses built-in and reserved variable names", () => {
    expect(restVariableSchema.safeParse({ id: "1", name: "jwt" }).success).toBe(false);
    expect(restVariableSchema.safeParse({ id: "1", name: "2x" }).success).toBe(false);
  });

  it("reads header lines", () => {
    expect(parseHeaderLine("Authorization: Bearer [jwt]")).toEqual({
      header: { key: "Authorization", value: "Bearer [jwt]" }
    });
    expect(parseHeaderLine("no colon")).toHaveProperty("error");
    expect(parseHeaderLine("bad key: x")).toHaveProperty("error");
  });
});

describe("rest placeholders and problems", () => {
  const group = { ...newRestGroup("g1", "Main"), baseUrl: "https://api.example.com/[version]" };

  it("needs every placeholder defined, built-ins excepted", () => {
    const c = call({
      url: "/users/[id]",
      headers: [{ key: "Authorization", value: "Bearer [jwt]" }],
      method: "POST",
      bodyType: "json",
      body: '{"name": "<name>", "count": <count>}',
      variables: [variable("id"), variable("name")]
    });
    expect(callProblems(c, group)).toEqual([
      '"version" is used but not defined in Variables.',
      '"count" is used but not defined in Variables.'
    ]);
  });

  it("reports JSON body errors with a line, ignoring placeholders", () => {
    expect(jsonBodyProblem('{\n  "a": <a>,\n  "b": "<b>"\n}')).toBeNull();
    expect(jsonBodyProblem('{\n  "a": 1,\n  "b": \n}')?.line).toBe(4);
  });

  it("formats a JSON body and keeps placeholders", () => {
    expect(formatJsonBody('{"a":<a>,"b":"x <b>"}')).toBe('{\n  "a": <a>,\n  "b": "x <b>"\n}');
    expect(formatJsonBody("{bad")).toBeNull();
  });

  it("needs a full https URL on ungrouped calls", () => {
    expect(callProblems(call({ groupId: null, url: "" }), null)).toEqual(["Enter the API URL."]);
    expect(callProblems(call({ groupId: null, url: "ftp://x" }), null)).toEqual([
      "The API URL must start with https://."
    ]);
  });
});

describe("rest filling", () => {
  it("types values and falls back to defaults", () => {
    expect(variableValue(variable("n", { type: "int", defaultValue: "2" }), undefined)).toBe(2);
    expect(variableValue(variable("n", { type: "int" }), "7")).toBe(7);
    expect(variableValue(variable("b", { type: "boolean" }), "true")).toBe(true);
    expect(variableValue(variable("l", { isList: true }), undefined)).toEqual([]);
  });

  it("fills URLs encoded and JSON bodies by context", () => {
    expect(fillBrackets("/q/[term]", { term: "a b/c" }, true)).toBe("/q/a%20b%2Fc");
    expect(fillJsonBody('{"a": <a>, "s": "hi <s>", "l": <l>}', { a: 3, s: 'x"y', l: ["p"] })).toBe(
      '{"a": 3, "s": "hi x\\"y", "l": ["p"]}'
    );
    expect(joinUrl("https://x.dev/api/", "/users")).toBe("https://x.dev/api/users");
  });
});
