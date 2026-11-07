/**
 * Local and private addresses are reachable only with ALLOW_PRIVATE_CONNECTOR_HOSTS=true outside
 * production. Cloud metadata and link-local addresses stay blocked either way.
 */
export const allowPrivateConnectorHosts = () =>
  process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS === "true" && process.env.NODE_ENV !== "production";
