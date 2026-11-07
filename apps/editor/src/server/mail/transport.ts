import { createTransport } from "nodemailer";
import type { SmtpAccount } from "./accounts";

// Builds the nodemailer transport. `tls` connects with TLS from the start (SMTP_SECURE=true or
// port 465); `starttls` upgrades with STARTTLS whenever the server offers it (usually 587).

export function smtpTransport(account: SmtpAccount) {
  return createTransport({
    host: account.host,
    port: account.port,
    secure: account.security === "tls",
    auth: account.username ? { user: account.username, pass: account.password ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
}

/** A short, safe description of an SMTP failure (server replies carry no secrets). */
export function smtpErrorMessage(error: unknown): string {
  const e = error as {
    code?: unknown;
    responseCode?: unknown;
    response?: unknown;
    message?: unknown;
  } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  if (code === "EAUTH") return "The SMTP server rejected the username or password.";
  if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION")
    return "Could not reach the SMTP server. Check the host, port and security.";
  if (code === "EDNS") return "The SMTP host could not be found.";
  if (code === "EENVELOPE") return "The server refused the sender or recipient address.";
  const response =
    typeof e?.response === "string" ? e.response : typeof e?.message === "string" ? e.message : "";
  return (response || "Sending failed.").replace(/[\r\n]+/g, " ").slice(0, 300);
}
