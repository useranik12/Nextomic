import { describe, expect, it } from "vitest";
import {
  PASSWORD_POLICIES,
  passwordPolicyFromEnv,
  passwordProblem,
  passwordScore
} from "./password-policy";

describe("password policy", () => {
  it("reads the env value and falls back to medium", () => {
    expect(passwordPolicyFromEnv("STRONG").name).toBe("strong");
    expect(passwordPolicyFromEnv(" very-strong ").name).toBe("very-strong");
    expect(passwordPolicyFromEnv(undefined).name).toBe("medium");
    expect(passwordPolicyFromEnv("nope").name).toBe("medium");
  });

  it("enforces each level", () => {
    expect(passwordProblem("abcdefgh", PASSWORD_POLICIES.basic)).toBeNull();
    expect(passwordProblem("abcdefgh", PASSWORD_POLICIES.medium)).toMatch(
      /10 characters.*a number/
    );
    expect(passwordProblem("abcdefgh12", PASSWORD_POLICIES.medium)).toBeNull();
    expect(passwordProblem("abcdefgh1234", PASSWORD_POLICIES.strong)).toMatch(/uppercase.*symbol/);
    expect(passwordProblem("Abcdefgh123!", PASSWORD_POLICIES.strong)).toBeNull();
    expect(passwordProblem("Abcdefgh123!", PASSWORD_POLICIES["very-strong"])).toMatch(/16/);
    expect(passwordProblem("x".repeat(129), PASSWORD_POLICIES.basic)).toMatch(/128/);
  });

  it("scores strength from 0 to 4", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abc")).toBe(1);
    expect(passwordScore("aaaaaaaaaaaaaaaa")).toBe(1);
    expect(passwordScore("abcdefgh12")).toBe(2);
    expect(passwordScore("Abcdefgh123!")).toBe(4);
  });
});
