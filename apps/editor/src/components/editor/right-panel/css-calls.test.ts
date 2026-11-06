import { describe, expect, it } from "vitest";
import {
  FILTER_FIELDS,
  TRANSFORM_FIELDS,
  parseCalls,
  readField,
  serializeCalls,
  writeField
} from "./css-calls";

const blur = FILTER_FIELDS[0]!;
const brightness = FILTER_FIELDS[1]!;
const rotate = TRANSFORM_FIELDS.find((f) => f.name === "rotate")!;

describe("css calls", () => {
  it("parses lists, nested calls and none", () => {
    expect(parseCalls("blur(4px) brightness(1.2)")).toEqual([
      { name: "blur", args: "4px" },
      { name: "brightness", args: "1.2" }
    ]);
    expect(parseCalls("drop-shadow(0 0 4px rgba(0,0,0,.5))")).toEqual([
      { name: "drop-shadow", args: "0 0 4px rgba(0,0,0,.5)" }
    ]);
    expect(parseCalls("none")).toEqual([]);
    expect(parseCalls(undefined)).toEqual([]);
    expect(parseCalls("garbage")).toBeNull();
    expect(parseCalls("blur(4px")).toBeNull();
  });

  it("round-trips and keeps unknown functions in place", () => {
    const calls = parseCalls("matrix(1,0,0,1,0,0) rotate(5deg)")!;
    const next = writeField(calls, rotate, 10);
    expect(serializeCalls(next)).toBe("matrix(1,0,0,1,0,0) rotate(10deg)");
  });

  it("drops a call when it returns to its neutral value", () => {
    const calls = parseCalls("blur(4px) brightness(1.5)")!;
    expect(serializeCalls(writeField(calls, blur, 0))).toBe("brightness(1.5)");
    expect(serializeCalls(writeField(calls, brightness, 1))).toBe("blur(4px)");
    expect(serializeCalls(writeField(writeField(calls, blur, 0), brightness, 1))).toBeNull();
  });

  it("adds a new call at the end and reads numbers back", () => {
    const next = writeField([], blur, 2.5);
    expect(serializeCalls(next)).toBe("blur(2.5px)");
    expect(readField(next, blur)).toBe(2.5);
    expect(readField(parseCalls("blur(1rem)")!, blur)).toBeNull();
  });
});
