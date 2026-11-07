import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ConnectorError } from "./errors";
import {
  decryptSecrets,
  encryptSecrets,
  keyringFromEnv,
  maskSecret,
  mergeSecrets,
  needsRotation
} from "./secrets";

const keyA = randomBytes(32).toString("base64");
const keyB = randomBytes(32).toString("base64");

describe("connector secrets", () => {
  it("round-trips and binds to the connector id", () => {
    const ring = keyringFromEnv({ ENCRYPTION_KEY: keyA });
    const sealed = encryptSecrets({ anonKey: "abc", token: "xyz" }, "conn-1", ring);
    expect(sealed.keyVersion).toBe(1);
    expect(sealed.ciphertext).not.toContain("abc");
    expect(decryptSecrets(sealed, "conn-1", ring)).toEqual({ anonKey: "abc", token: "xyz" });
    expect(() => decryptSecrets(sealed, "conn-2", ring)).toThrow(ConnectorError);
  });

  it("uses a fresh iv every time", () => {
    const ring = keyringFromEnv({ ENCRYPTION_KEY: keyA });
    const a = encryptSecrets({ k: "v" }, "c", ring);
    const b = encryptSecrets({ k: "v" }, "c", ring);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects tampered ciphertext", () => {
    const ring = keyringFromEnv({ ENCRYPTION_KEY: keyA });
    const sealed = encryptSecrets({ k: "value" }, "c", ring);
    const bytes = Buffer.from(sealed.ciphertext, "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    expect(() =>
      decryptSecrets({ ...sealed, ciphertext: bytes.toString("base64") }, "c", ring)
    ).toThrow(/could not be read/);
  });

  it("reads secrets saved with a previous key after rotation", () => {
    const old = keyringFromEnv({ ENCRYPTION_KEY: keyA });
    const sealed = encryptSecrets({ k: "v" }, "c", old);
    const rotated = keyringFromEnv({
      ENCRYPTION_KEY: keyB,
      ENCRYPTION_KEY_VERSION: "2",
      ENCRYPTION_PREVIOUS_KEYS: `1:${keyA}`
    });
    expect(needsRotation(sealed, rotated)).toBe(true);
    expect(decryptSecrets(sealed, "c", rotated)).toEqual({ k: "v" });
    expect(encryptSecrets({ k: "v" }, "c", rotated).keyVersion).toBe(2);
    const withoutOld = keyringFromEnv({ ENCRYPTION_KEY: keyB, ENCRYPTION_KEY_VERSION: "2" });
    expect(() => decryptSecrets(sealed, "c", withoutOld)).toThrow(/not configured/);
  });

  it("validates the environment", () => {
    expect(() => keyringFromEnv({})).toThrow(/ENCRYPTION_KEY is not set/);
    expect(() => keyringFromEnv({ ENCRYPTION_KEY: "short" })).toThrow(/32 bytes/);
    expect(() => keyringFromEnv({ ENCRYPTION_KEY: keyA, ENCRYPTION_KEY_VERSION: "0" })).toThrow();
    expect(() =>
      keyringFromEnv({ ENCRYPTION_KEY: keyA, ENCRYPTION_PREVIOUS_KEYS: "nope" })
    ).toThrow(/version:base64/);
  });

  it("masks secrets and only shows the tail of long ones", () => {
    expect(maskSecret("short")).toEqual({ hasSecret: true, tail: null });
    expect(maskSecret("eyJhbGciOiJIUzI1NiIsInR5cCI6")).toEqual({ hasSecret: true, tail: "cCI6" });
  });

  it("keeps saved values for blank fields and removes nulls", () => {
    expect(
      mergeSecrets({ a: "1", b: "2", c: "3" }, { a: "", b: "new", c: null, d: undefined })
    ).toEqual({ a: "1", b: "new" });
  });
});
