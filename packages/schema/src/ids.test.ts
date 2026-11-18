import { describe, expect, it } from "vitest";
import { isUuid, uuidSchema } from "./ids";

describe("row ids", () => {
  it("accepts uuids of any version and case", () => {
    expect(isUuid("ae8d4220-315c-46fa-840e-c6e9c18a32ff")).toBe(true);
    expect(isUuid("AE8D4220-315C-46FA-840E-C6E9C18A32FF")).toBe(true);
    expect(isUuid("01a1f0c0-d600-75d1-9622-ef77f7d5a4ce")).toBe(true);
  });

  it("refuses everything else", () => {
    for (const bad of [
      "",
      "abc",
      "0be681a6b626e813e7f146f5",
      "ae8d4220315c46fa840ec6e9c18a32ff",
      "ae8d4220-315c-46fa-840e-c6e9c18a32f",
      "ae8d4220-315c-46fa-840e-c6e9c18a32ff ",
      "ae8d4220-315c-46fa-840e-c6e9c18a32ff/x",
      5,
      null,
      undefined
    ]) {
      expect(isUuid(bad)).toBe(false);
    }
    expect(uuidSchema.safeParse("nope").success).toBe(false);
    expect(uuidSchema.safeParse("ae8d4220-315c-46fa-840e-c6e9c18a32ff").success).toBe(true);
  });
});
