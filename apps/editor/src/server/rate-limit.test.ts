import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows the limit per window, then blocks until the window resets", () => {
    const limiter = createRateLimiter(2, 1000);
    expect(limiter.take("a", 0).ok).toBe(true);
    expect(limiter.take("a", 10).ok).toBe(true);
    expect(limiter.take("a", 20)).toEqual({ ok: false, retryAfterMs: 980 });
    expect(limiter.take("b", 20).ok).toBe(true);
    expect(limiter.take("a", 1000).ok).toBe(true);
  });
});
