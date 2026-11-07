import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ConnectorError } from "./errors";

// Connector secrets are encrypted with AES-256-GCM. The current key encrypts; older keys stay
// readable by their version so a key can be rotated without breaking saved connectors. The
// connector id is bound in as additional data, so ciphertext copied to another row fails to open.

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

export interface Keyring {
  current: number;
  keys: ReadonlyMap<number, Buffer>;
}

const KEY_BYTES = 32;
const IV_BYTES = 12;

function decodeKey(value: string, label: string): Buffer {
  const key = Buffer.from(value.trim(), "base64");
  if (key.length !== KEY_BYTES)
    throw new Error(`${label} must be ${KEY_BYTES} bytes encoded as base64.`);
  return key;
}

function parseVersion(value: string, label: string): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1)
    throw new Error(`${label} must be a whole number of 1 or more.`);
  return version;
}

/**
 * Reads the keyring from the environment:
 * - `ENCRYPTION_KEY`: the current key (32 bytes, base64). Required.
 * - `ENCRYPTION_KEY_VERSION`: its version, default 1. Raise it when the key changes.
 * - `ENCRYPTION_PREVIOUS_KEYS`: older keys still needed to read, as `version:base64,version:base64`.
 */
export function keyringFromEnv(env: Record<string, string | undefined>): Keyring {
  const raw = env.ENCRYPTION_KEY;
  if (!raw)
    throw new Error("ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.");
  const current = parseVersion(env.ENCRYPTION_KEY_VERSION ?? "1", "ENCRYPTION_KEY_VERSION");
  const keys = new Map<number, Buffer>();
  for (const entry of (env.ENCRYPTION_PREVIOUS_KEYS ?? "").split(",")) {
    if (!entry.trim()) continue;
    const at = entry.indexOf(":");
    if (at < 0)
      throw new Error("ENCRYPTION_PREVIOUS_KEYS entries must look like `version:base64`.");
    const version = parseVersion(entry.slice(0, at), "ENCRYPTION_PREVIOUS_KEYS version");
    keys.set(version, decodeKey(entry.slice(at + 1), `ENCRYPTION_PREVIOUS_KEYS key ${version}`));
  }
  keys.set(current, decodeKey(raw, "ENCRYPTION_KEY"));
  return { current, keys };
}

/** Encrypts a secrets object with the current key, bound to `bindTo` (the connector id). */
export function encryptSecrets(
  value: Record<string, string>,
  bindTo: string,
  keyring: Keyring
): EncryptedSecret {
  const key = keyring.keys.get(keyring.current);
  if (!key) throw new Error("The current encryption key is missing from the keyring.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(bindTo, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    keyVersion: keyring.current
  };
}

/** Opens secrets sealed by `encryptSecrets`. Any tampering, wrong key or wrong row fails. */
export function decryptSecrets(
  sealed: EncryptedSecret,
  bindTo: string,
  keyring: Keyring
): Record<string, string> {
  const key = keyring.keys.get(sealed.keyVersion);
  if (!key)
    throw new ConnectorError(
      "decrypt_failed",
      "The key that saved these secrets is not configured."
    );
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
    decipher.setAAD(Buffer.from(bindTo, "utf8"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    const text = Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("shape");
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "string") out[k] = v;
    return out;
  } catch {
    throw new ConnectorError("decrypt_failed", "The saved secrets could not be read.");
  }
}

/** True when the secret was sealed with an older key and should be re-encrypted on next save. */
export const needsRotation = (sealed: EncryptedSecret, keyring: Keyring) =>
  sealed.keyVersion !== keyring.current;

export interface SecretMask {
  hasSecret: true;
  /** The last 4 characters, only for secrets long enough that this reveals little. */
  tail: string | null;
}

/** What the browser may see of a secret: that it exists and, for long ones, its last 4 characters. */
export function maskSecret(value: string): SecretMask {
  return { hasSecret: true, tail: value.length >= 16 ? value.slice(-4) : null };
}

/**
 * Merges a secrets form into the saved secrets: a blank or missing field keeps the saved value,
 * `null` removes it, any other text replaces it.
 */
export function mergeSecrets(
  saved: Record<string, string>,
  incoming: Record<string, string | null | undefined>
): Record<string, string> {
  const out = { ...saved };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null) delete out[key];
    else if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}
