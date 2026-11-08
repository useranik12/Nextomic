import { describe, expect, it } from "vitest";
import {
  inferJsonType,
  jsonShape,
  parseJsonPath,
  readJsonPath,
  recommendedJsonPaths
} from "./json-path";

const response = {
  data: [
    { monitor_tag: "api", timestamp: 1790448300, latency: 13.5 },
    { monitor_tag: "web", timestamp: 1790449200, latency: 11 }
  ],
  "odd key": true
};

describe("json paths", () => {
  it("reads fields, items and spreads", () => {
    expect(readJsonPath(response, "$.data[:].monitor_tag")).toEqual(["api", "web"]);
    expect(readJsonPath(response, "$.data[1].timestamp")).toBe(1790449200);
    expect(readJsonPath(response, '$["odd key"]')).toBe(true);
    expect(readJsonPath(response, "$[:].data")).toEqual([]);
    expect(readJsonPath(response, "$.missing")).toBeNull();
    expect(parseJsonPath("data")).toHaveProperty("error");
  });

  it("infers types and recommends top-level paths", () => {
    expect(inferJsonType(readJsonPath(response, "$.data[:].timestamp"))).toEqual({
      type: "int",
      isList: true
    });
    expect(inferJsonType(13.5)).toEqual({ type: "float", isList: false });
    expect(recommendedJsonPaths(response)).toEqual(["$.data", '$["odd key"]']);
    expect(recommendedJsonPaths([{ id: 1 }])).toEqual(["$[:].id"]);
  });

  it("keeps the shape only, never values", () => {
    const shape = jsonShape(response);
    expect(JSON.stringify(shape)).not.toContain("api");
    expect(shape).toEqual({
      kind: "object",
      fields: {
        data: {
          kind: "list",
          item: {
            kind: "object",
            fields: {
              monitor_tag: { kind: "string" },
              timestamp: { kind: "int" },
              latency: { kind: "float" }
            }
          }
        },
        "odd key": { kind: "boolean" }
      }
    });
  });
});
