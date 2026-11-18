import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUARDED_MATCHERS, hasBadId } from "./id-guard";

const ID = "ae8d4220-315c-46fa-840e-c6e9c18a32ff";

describe("hasBadId", () => {
  it("lets uuids through on every guarded route", () => {
    for (const path of [
      `/media/${ID}/${ID}/photo.webp`,
      `/avatars/${ID}/a.webp`,
      `/fonts/${ID}/some-font/file.woff2`,
      `/icons/${ID}/x.svg`,
      `/theme-css/${ID}/theme.css`
    ])
      expect(hasBadId(path), path).toBe(false);
  });

  it("refuses a bad id on every guarded route", () => {
    for (const path of [
      "/media/nope/a/f.webp",
      `/media/${ID}/0be681a6b626e813e7f146f5/f.webp`,
      "/avatars/P1GQWNeRc7ohaNf6dhX75x8UJvYtFd79/a.webp",
      "/fonts/%E0%A4%A/x",
      "/icons/..%2F..%2Fetc/x.svg",
      "/theme-css/x/y.css"
    ])
      expect(hasBadId(path), path).toBe(true);
  });

  it("ignores routes that carry no ids", () => {
    expect(hasBadId("/sign-in")).toBe(false);
    expect(hasBadId("/projects")).toBe(false);
    expect(hasBadId("/brand/logo/x.svg")).toBe(false);
  });

  it("keeps the proxy matcher in step with the guarded prefixes", () => {
    const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
    for (const matcher of GUARDED_MATCHERS) expect(source).toContain(`"${matcher}"`);
  });
});
