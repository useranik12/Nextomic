import { describe, expect, it } from "vitest";
import { readStudioEnv } from "./studio-env";

describe("readStudioEnv", () => {
  it("refuses to start without an admin list", () => {
    expect(() => readStudioEnv({})).toThrow("STUDIO_ADMIN_EMAILS");
    expect(() => readStudioEnv({ STUDIO_ADMIN_EMAILS: " , " })).toThrow("STUDIO_ADMIN_EMAILS");
  });

  it("lowercases emails and applies defaults", () => {
    expect(readStudioEnv({ STUDIO_ADMIN_EMAILS: 'Me@Example.com, "you@example.com"' })).toEqual({
      port: 3002,
      basePath: "/studio",
      adminEmails: ["me@example.com", "you@example.com"],
      allowedIps: []
    });
  });

  it("normalizes the base path and reads the ip list", () => {
    const env = readStudioEnv({
      STUDIO_ADMIN_EMAILS: "a@b.co",
      STUDIO_BASE_PATH: "admin/",
      STUDIO_ALLOWED_IPS: "10.0.0.*, 127.0.0.1",
      PORT: "4000"
    });
    expect(env).toMatchObject({
      basePath: "/admin",
      port: 4000,
      allowedIps: ["10.0.0.*", "127.0.0.1"]
    });
  });

  it("rejects a bad port or path", () => {
    expect(() => readStudioEnv({ STUDIO_ADMIN_EMAILS: "a@b.co", PORT: "x" })).toThrow("PORT");
    expect(() => readStudioEnv({ STUDIO_ADMIN_EMAILS: "a@b.co", STUDIO_BASE_PATH: "/" })).toThrow(
      "STUDIO_BASE_PATH"
    );
    expect(() =>
      readStudioEnv({ STUDIO_ADMIN_EMAILS: "a@b.co", STUDIO_BASE_PATH: "/a b" })
    ).toThrow("STUDIO_BASE_PATH");
  });
});
