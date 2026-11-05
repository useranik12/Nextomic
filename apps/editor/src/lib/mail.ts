import { createTransport, type Transporter } from "nodemailer";
import { z } from "zod";

// Single env-configured SMTP transport. Per-workspace multi-SMTP with a settings UI is Phase 12
// (docs/platform.md section 4); this is the bridge so a fresh deploy can send auth email.
const smtpEnvSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false", ""]).optional(),
  SMTP_USERNAME: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().min(3)
});

type SmtpConfig = z.infer<typeof smtpEnvSchema>;

function readSmtpConfig(): SmtpConfig | null {
  if (!process.env.SMTP_HOST) return null;
  const parsed = smtpEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid SMTP configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`
    );
  }
  return parsed.data;
}

/** Email verification is only enforced when mail can actually be delivered. */
export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

let transport: Transporter | undefined;

function getTransport(config: SmtpConfig): Transporter {
  transport ??= createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE ? config.SMTP_SECURE === "true" : config.SMTP_PORT === 465,
    auth: config.SMTP_USERNAME
      ? { user: config.SMTP_USERNAME, pass: config.SMTP_PASSWORD ?? "" }
      : undefined
  });
  return transport;
}

export interface AuthEmail {
  kind: "verify-email" | "reset-password";
  to: string;
  url: string;
}

const COPY: Record<AuthEmail["kind"], { subject: string; intro: string; action: string }> = {
  "verify-email": {
    subject: "Verify your Nextomic email",
    intro: "Confirm your email address to finish creating your Nextomic account.",
    action: "Verify email"
  },
  "reset-password": {
    subject: "Reset your Nextomic password",
    intro:
      "Use the link below to choose a new password. If you did not ask for this, ignore this email.",
    action: "Reset password"
  }
};

export async function sendAuthEmail({ kind, to, url }: AuthEmail): Promise<void> {
  const config = readSmtpConfig();
  if (!config) {
    if (process.env.DEV_EMAIL_TO_CONSOLE === "true") {
      // eslint-disable-next-line no-console
      console.log(`[auth email:${kind}] to=${to} url=${url}`);
      return;
    }
    throw new Error("No email transport configured. Set SMTP_HOST and the other SMTP_* variables.");
  }
  const copy = COPY[kind];
  await getTransport(config).sendMail({
    from: config.SMTP_FROM,
    to,
    subject: copy.subject,
    text: `${copy.intro}\n\n${url}\n`,
    html: `<p>${copy.intro}</p><p><a href="${url}">${copy.action}</a></p><p>${url}</p>`
  });
}
