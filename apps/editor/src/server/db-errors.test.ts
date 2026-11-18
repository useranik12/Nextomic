import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./db-errors";

describe("isUniqueViolation", () => {
  it("reads the driver error directly", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });
  it("reads the driver error Drizzle keeps on cause", () => {
    expect(isUniqueViolation(new Error("Failed query", { cause: { code: "23505" } }))).toBe(true);
  });
  it("ignores other errors", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("x", { cause: { code: "42P01" } }))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
