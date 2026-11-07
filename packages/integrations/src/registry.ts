import type { Connector, ConnectorType } from "./types";

// Connectors register here, like elements in the component registry. Supabase (4d) and REST (4c)
// add themselves; callers only ever look them up by type.

type AnyConnector = Connector<unknown, unknown>;

const registry = new Map<ConnectorType, AnyConnector>();

export function registerConnector<TConfig, TSecrets>(connector: Connector<TConfig, TSecrets>) {
  registry.set(connector.type, connector as unknown as AnyConnector);
}

export function getConnector(type: ConnectorType): AnyConnector | undefined {
  return registry.get(type);
}

export function registeredConnectorTypes(): ConnectorType[] {
  return [...registry.keys()];
}
