import { describe, expect, it } from "vitest";
import { authBaseUrl, authTrustedOrigins, toOrigin } from "./auth-url";

describe("auth url", () => {
  it("normalizes the public origin", () => {
    expect(toOrigin("https://nextomic.kovidaa.com/")).toBe("https://nextomic.kovidaa.com");
    expect(toOrigin(' "https://nextomic.kovidaa.com/x" ')).toBe("https://nextomic.kovidaa.com");
    expect(toOrigin("nextomic.kovidaa.com")).toBeNull();
    expect(toOrigin("javascript:alert(1)")).toBeNull();
  });

  it("trusts the base origin plus extra ones", () => {
    const env = {
      BETTER_AUTH_URL: "https://nextomic.kovidaa.com/",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://www.kovidaa.com, bad, https://nextomic.kovidaa.com"
    };
    expect(authBaseUrl(env)).toBe("https://nextomic.kovidaa.com");
    expect(authTrustedOrigins(env)).toEqual([
      "https://nextomic.kovidaa.com",
      "https://www.kovidaa.com"
    ]);
  });
});
