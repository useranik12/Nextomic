import { z } from "zod";

// SMTP comes only from the SMTP_* variables (Docker Compose / Dokploy). There is no SMTP screen
// in the builder; built apps read the same kind of variables from their own environment.

export type SmtpSecurity = "tls" | "starttls";

/** Everything needed to send. Server only. */
export interface SmtpAccount {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string | null;
  password: string | null;
  from: { name: string; address: string };
}

const envSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false", ""]).optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().min(3)
});

/** `Name <address>` or a bare address. */
export function parseMailbox(value: string): { name: string; address: string } {
  const match = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(value);
  if (match) return { name: (match[1] ?? "").trim(), address: (match[2] ?? "").trim() };
  return { name: "", address: value.trim() };
}

/** The SMTP account from the environment, or null when SMTP_HOST is not set. */
export function smtpFromEnv(
  env: Record<string, string | undefined> = process.env
): SmtpAccount | null {
  if (!env.SMTP_HOST) return null;
  const parsed = envSchema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid SMTP configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`
    );
  const smtp = parsed.data;
  const secure = smtp.SMTP_SECURE ? smtp.SMTP_SECURE === "true" : smtp.SMTP_PORT === 465;
  return {
    host: smtp.SMTP_HOST,
    port: smtp.SMTP_PORT,
    security: secure ? "tls" : "starttls",
    username: smtp.SMTP_USERNAME || null,
    password: smtp.SMTP_PASSWORD || null,
    from: parseMailbox(smtp.SMTP_FROM)
  };
}
