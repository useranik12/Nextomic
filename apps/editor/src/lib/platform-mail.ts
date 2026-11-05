import nodemailer from "nodemailer";

function getMailTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, and SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({ host, port, auth: { user, pass } });
}

export async function sendPlatformEmail(input: { to: string; subject: string; text: string }): Promise<void> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    throw new Error("SMTP_FROM is required before platform email can be sent.");
  }

  await getMailTransport().sendMail({ from, ...input });
}
