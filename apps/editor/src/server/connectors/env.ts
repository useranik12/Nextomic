import { ConnectorError, keyringFromEnv, type Keyring } from "@nextomic/integrations";

let keyring: Keyring | null = null;

/** The connector secrets keyring from ENCRYPTION_KEY (and older keys for rotation). */
export function connectorKeyring(): Keyring {
  if (keyring) return keyring;
  try {
    keyring = keyringFromEnv(process.env);
    return keyring;
  } catch (error) {
    throw new ConnectorError(
      "invalid_config",
      `Connector secrets are unavailable: ${error instanceof Error ? error.message : "the encryption key is invalid."}`
    );
  }
}

/**
 * Local and private addresses are reachable only with ALLOW_PRIVATE_CONNECTOR_HOSTS=true outside
 * production. Cloud metadata and link-local addresses stay blocked either way.
 */
export const allowPrivateConnectorHosts = () =>
  process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS === "true" && process.env.NODE_ENV !== "production";
