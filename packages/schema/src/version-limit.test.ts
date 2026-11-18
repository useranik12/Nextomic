import { describe, expect, it } from "vitest";
import {
  VERSION_LIMIT_MAX,
  effectiveVersionLimit,
  projectSettingsSchema,
  defaultProjectSettings
} from "./project-settings";
import { pageSettingsSchema } from "./page";

describe("version limit", () => {
  it("is 50 by default", () => {
    expect(VERSION_LIMIT_MAX).toBe(50);
    expect(defaultProjectSettings().versionLimit).toBe(50);
  });

  it("lowers a stored 200 to 50 instead of refusing the whole settings object", () => {
    const stored = projectSettingsSchema.safeParse({ versionLimit: 200 });
    expect(stored.success).toBe(true);
    expect(stored.success && stored.data.versionLimit).toBe(50);
    const page = pageSettingsSchema.safeParse({ versionLimit: 120 });
    expect(page.success && page.data.versionLimit).toBe(50);
  });

  it("still refuses a limit below the minimum and keeps null for a page", () => {
    expect(projectSettingsSchema.safeParse({ versionLimit: 2 }).success).toBe(false);
    const page = pageSettingsSchema.safeParse({});
    expect(page.success && page.data.versionLimit).toBeNull();
  });

  it("never exceeds the maximum", () => {
    expect(effectiveVersionLimit({ versionLimit: 50 }, { versionLimit: 200 })).toBe(50);
  });
});
