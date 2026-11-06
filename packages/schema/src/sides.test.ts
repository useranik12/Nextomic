import { describe, expect, it } from "vitest";
import {
  SIDE_SETS,
  expandShorthand,
  hasSides,
  readSides,
  sidesPatch,
  sidesRelation
} from "./sides";

const margin = SIDE_SETS.margin!;

describe("expandShorthand", () => {
  it("expands one to four values", () => {
    expect(expandShorthand("8px")).toEqual(["8px", "8px", "8px", "8px"]);
    expect(expandShorthand("0 auto")).toEqual(["0", "auto", "0", "auto"]);
    expect(expandShorthand("1px 2px 3px")).toEqual(["1px", "2px", "3px", "2px"]);
    expect(expandShorthand("1px 2px 3px 4px")).toEqual(["1px", "2px", "3px", "4px"]);
  });
  it("keeps functions together and rejects too many values", () => {
    expect(expandShorthand("calc(1px + 2px) 4px")).toEqual([
      "calc(1px + 2px)",
      "4px",
      "calc(1px + 2px)",
      "4px"
    ]);
    expect(expandShorthand("1 2 3 4 5")).toBeNull();
    expect(expandShorthand("")).toBeNull();
  });
});

describe("readSides and sidesPatch", () => {
  it("reads the shorthand and lets longhands win", () => {
    expect(readSides({ margin: "0 auto" }, margin)).toEqual(["0", "auto", "0", "auto"]);
    expect(readSides({ margin: "4px", "margin-left": "9px" }, margin)).toEqual([
      "4px",
      "4px",
      "4px",
      "9px"
    ]);
    expect(readSides(undefined, margin)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("collapses four equal values into the shorthand", () => {
    const patch = sidesPatch(["8px", "8px", "8px", "8px"], margin);
    expect(patch.margin).toBe("8px");
    expect(patch["margin-top"]).toBeNull();
  });

  it("writes longhands, and drops the shorthand, when sides differ", () => {
    const patch = sidesPatch(["8px", "4px", "8px", undefined], margin);
    expect(patch.margin).toBeNull();
    expect(patch["margin-top"]).toBe("8px");
    expect(patch["margin-right"]).toBe("4px");
    expect(patch["margin-left"]).toBeNull();
  });

  it("uses longhands only for sets without a shorthand", () => {
    const patch = sidesPatch(["1px", "1px", "1px", "1px"], SIDE_SETS.inset!);
    expect(patch).toEqual({ top: "1px", right: "1px", bottom: "1px", left: "1px" });
  });

  it("reports what is set and how the sides relate", () => {
    expect(hasSides({ "margin-top": "1px" }, margin)).toBe(true);
    expect(hasSides({ color: "red" }, margin)).toBe(false);
    expect(sidesRelation(["1", "1", "1", "1"])).toBe("all");
    expect(sidesRelation(["1", "2", "1", "2"])).toBe("pairs");
    expect(sidesRelation(["1", "2", "3", "2"])).toBe("free");
  });
});
