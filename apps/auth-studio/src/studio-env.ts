// Settings of the auth dashboard service, read from the environment (Dokploy's Environment tab).

export interface StudioEnv {
  port: number;
  /** URL path the dashboard is served under. */
  basePath: string;
  /** Only these accounts can open the dashboard. Never empty. */
  adminEmails: string[];
  /** Optional IP allowlist (exact addresses or patterns such as 192.168.*). */
  allowedIps: string[];
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter((item) => item.length > 0);
}

export function readStudioEnv(env: Record<string, string | undefined> = process.env): StudioEnv {
  const adminEmails = list(env.STUDIO_ADMIN_EMAILS).map((email) => email.toLowerCase());
  // Studio treats an empty list as "any signed-in account", so an unset list must stop the service
  // instead of opening the dashboard to everyone.
  if (adminEmails.length === 0) {
    throw new Error(
      "STUDIO_ADMIN_EMAILS is required: the comma-separated emails allowed to open the dashboard."
    );
  }
  const port = Number(env.PORT ?? "3002");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a port number, got "${env.PORT}".`);
  }
  const rawPath = (env.STUDIO_BASE_PATH ?? "/studio").trim();
  const basePath = `/${rawPath.replace(/^\/+|\/+$/g, "")}`;
  if (basePath === "/" || !/^\/[A-Za-z0-9._~/-]+$/.test(basePath)) {
    throw new Error("STUDIO_BASE_PATH must be a path such as /studio.");
  }
  return { port, basePath, adminEmails, allowedIps: list(env.STUDIO_ALLOWED_IPS) };
}
