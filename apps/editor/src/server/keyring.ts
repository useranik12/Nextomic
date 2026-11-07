import { ConnectorError, keyringFromEnv, type Keyring } from "@nextomic/integrations";

// The platform's secrets keyring (ENCRYPTION_KEY, with older keys kept for rotation). Connector
// secrets and SMTP passwords are sealed with it; each binds its own row id as additional data.

let keyring: Keyring | null = null;

export function platformKeyring(): Keyring {
  if (keyring) return keyring;
  try {
    keyring = keyringFromEnv(process.env);
    return keyring;
  } catch (error) {
    throw new ConnectorError(
      "invalid_config",
      `Saved secrets are unavailable: ${error instanceof Error ? error.message : "the encryption key is invalid."}`
    );
  }
}
