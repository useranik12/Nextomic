import { describe, expect, it } from "vitest";
import {
  availableVariables,
  callPlaceholders,
  callProblems,
  callVariables,
  groupProblems,
  jsonPathValues,
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
      body: '{"name": "[name]", "count": [count]}',
      variables: [variable("id"), variable("name")]
    });
    expect(callProblems(c, group)).toEqual([
      '"count" is used but not defined in Variables.',
      '"version" is used but not defined in Variables.'
    ]);
  });

  it("reports JSON body errors with a line, ignoring placeholders", () => {
    expect(jsonBodyProblem('{\n  "a": [a],\n  "b": "[b]"\n}')).toBeNull();
    expect(jsonBodyProblem('{\n  "a": 1,\n  "b": \n}')?.line).toBe(4);
  });

  it("formats a JSON body and keeps placeholders", () => {
    expect(formatJsonBody('{"a":[a],"b":"x [b]"}')).toBe('{\n  "a": [a],\n  "b": "x [b]"\n}');
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
    expect(fillJsonBody('{"a": [a], "s": "hi [s]", "l": [l]}', { a: 3, s: 'x"y', l: ["p"] })).toBe(
      '{"a": 3, "s": "hi x\\"y", "l": ["p"]}'
    );
    expect(joinUrl("https://x.dev/api/", "/users")).toBe("https://x.dev/api/users");
  });
});

describe("group variables, query parameters and [name] placeholders", () => {
  const group = { ...newRestGroup("g1", "Main"), variables: [variable("version"), variable("id")] };

  it("lets calls use group variables, with the call's own variable winning", () => {
    const own = call({
      url: "/[version]/users/[id]",
      variables: [variable("id", { type: "int" })]
    });
    expect(callProblems(own, group)).toEqual([]);
    expect(callVariables(own, group).map((v) => `${v.name}:${v.type}`)).toEqual([
      "id:int",
      "version:string"
    ]);
    expect(availableVariables(own.variables, group.variables).map((v) => v.from)).toEqual([
      "call",
      "group",
      "server",
      "server"
    ]);
    expect(callProblems(own, null)).toContain('"version" is used but not defined in Variables.');
  });

  it("checks a group's own placeholders and duplicate names", () => {
    expect(groupProblems({ ...group, baseUrl: "https://x.dev/[version]" })).toEqual([]);
    expect(groupProblems({ ...group, baseUrl: "https://x.dev/[missing]" })[0]).toContain(
      '"missing"'
    );
    expect(groupProblems({ ...group, variables: [variable("a"), variable("a")] })[0]).toContain(
      "Two group variables"
    );
  });

  it("counts query keys and values as used placeholders", () => {
    const own = call({ query: [{ key: "q", value: "[term]" }] });
    expect(callPlaceholders(own, null)).toEqual(["term"]);
  });

  it("keeps [true], [false] and [null] as JSON arrays and refuses them as names", () => {
    expect(jsonBodyProblem('{"flags": [true], "n": [null], "x": [count]}')).toBeNull();
    expect(fillJsonBody('{"f": [true], "c": [count]}', { count: 2, true: 1 })).toBe(
      '{"f": [true], "c": 2}'
    );
    expect(restVariableSchema.safeParse({ id: "t", name: "true" }).success).toBe(false);
  });

  it("reads saved JSON paths by name", () => {
    const json = { data: [{ id: 1 }, { id: 2 }], total: 2 };
    expect(
      jsonPathValues(
        [
          { name: "ids", path: "$.data[:].id" },
          { name: "total", path: "$.total" },
          { name: "none", path: "$.missing" }
        ],
        json
      )
    ).toEqual({ ids: [1, 2], total: 2, none: null });
  });
});
