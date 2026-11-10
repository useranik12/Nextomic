import { describe, expect, it } from "vitest";
import { applyStateOp, valueText } from "./state-ops";

const int = { type: "int", isList: false } as const;
const bool = { type: "boolean", isList: false } as const;
const list = { type: "string", isList: true } as const;

describe("applyStateOp", () => {
  it("sets, resets and clears", () => {
    expect(applyStateOp("set", "a", "x", "b", undefined)).toBe("b");
    expect(applyStateOp("reset", "a", "x", null, undefined)).toBe("x");
    expect(applyStateOp("clear", '["a"]', "[]", null, list)).toBe("[]");
    expect(applyStateOp("clear", "5", "0", null, int)).toBe("");
  });

  it("toggles booleans and counts numbers", () => {
    expect(applyStateOp("toggle", "false", "false", null, bool)).toBe("true");
    expect(applyStateOp("toggle", "true", "false", null, bool)).toBe("false");
    expect(applyStateOp("increment", "2", "0", null, int)).toBe("3");
    expect(applyStateOp("increment", "2", "0", 5, int)).toBe("7");
    expect(applyStateOp("decrement", "", "0", "2", int)).toBe("-2");
    expect(() => applyStateOp("increment", "1", "0", "abc", int)).toThrow(
      "Increment needs a number."
    );
  });

  it("edits lists", () => {
    expect(applyStateOp("append", '["a"]', "[]", "b", list)).toBe('["a","b"]');
    expect(applyStateOp("prepend", '["a"]', "[]", "b", list)).toBe('["b","a"]');
    expect(applyStateOp("remove", '["a","b","a"]', "[]", "a", list)).toBe('["b"]');
    expect(applyStateOp("removeAt", '["a","b"]', "[]", "0", list)).toBe('["b"]');
    expect(applyStateOp("append", "", "[]", "a", list)).toBe('["a"]');
  });

  it("rejects unknown operations", () => {
    expect(() => applyStateOp("explode", "", "", null, undefined)).toThrow(
      'Unknown state operation "explode".'
    );
  });
});

describe("valueText", () => {
  it("stores scalars as text and the rest as JSON", () => {
    expect(valueText(null)).toBe("");
    expect(valueText(3)).toBe("3");
    expect(valueText(true)).toBe("true");
    expect(valueText({ a: 1 })).toBe('{"a":1}');
  });
});
