import { emailTemplates, getDb, type EmailKind } from "@nextomic/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Platform email templates: subject, HTML and plain text with {{variable}} placeholders. Values
// are HTML-escaped in the HTML part and line breaks are removed from the subject.

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export const EMAIL_KINDS: readonly EmailKind[] = ["verify-email", "reset-password", "test"];

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  "verify-email": "Verify email",
  "reset-password": "Reset password",
  test: "Test email"
};

export const TEMPLATE_VARIABLES: Record<EmailKind, { name: string; description: string }[]> = {
  "verify-email": [
    { name: "name", description: "The person's name" },
    { name: "email", description: "Their email address" },
    { name: "url", description: "The verification link" },
    { name: "appName", description: "Nextomic" }
  ],
  "reset-password": [
    { name: "name", description: "The person's name" },
    { name: "email", description: "Their email address" },
    { name: "url", description: "The password reset link" },
    { name: "appName", description: "Nextomic" }
  ],
  test: [
    { name: "name", description: "Who sent the test" },
    { name: "accountName", description: "The SMTP account used" },
    { name: "appName", description: "Nextomic" }
  ]
};

const button = (label: string) =>
  `<p><a href="{{url}}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600">${label}</a></p>`;
const shell = (body: string) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#18181b;max-width:520px">${body}</div>`;

export const DEFAULT_TEMPLATES: Record<EmailKind, EmailTemplate> = {
  "verify-email": {
    subject: "Verify your {{appName}} email",
    html: shell(
      `<p>Hi {{name}},</p><p>Confirm your email address to finish creating your {{appName}} account.</p>${button("Verify email")}<p style="color:#71717a;font-size:13px">Or open this link: {{url}}</p>`
    ),
    text: "Hi {{name}},\n\nConfirm your email address to finish creating your {{appName}} account:\n\n{{url}}\n"
  },
  "reset-password": {
    subject: "Reset your {{appName}} password",
    html: shell(
      `<p>Hi {{name}},</p><p>Use the button below to choose a new password. If you did not ask for this, ignore this email.</p>${button("Reset password")}<p style="color:#71717a;font-size:13px">Or open this link: {{url}}</p>`
    ),
    text: "Hi {{name}},\n\nUse this link to choose a new password. If you did not ask for this, ignore this email.\n\n{{url}}\n"
  },
  test: {
    subject: "{{appName}} test email",
    html: shell(
      `<p>This is a test email from {{appName}}, sent by {{name}} with the SMTP account “{{accountName}}”.</p><p>If you can read this, the account works.</p>`
    ),
    text: 'This is a test email from {{appName}}, sent by {{name}} with the SMTP account "{{accountName}}".\n\nIf you can read this, the account works.\n'
  }
};

export const emailTemplateSchema = z.object({
  subject: z.string().trim().min(1, "Enter a subject.").max(300),
  html: z.string().min(1, "Enter the HTML version.").max(100_000),
  text: z.string().min(1, "Enter the plain-text version.").max(50_000)
});

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );

const fill = (source: string, vars: Record<string, string>, encode: (v: string) => string) =>
  source.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g, (_m, name: string) =>
    encode(vars[name] ?? "")
  );

/** Fills a template's placeholders. Unknown placeholders become empty. */
export function renderTemplate(
  template: EmailTemplate,
  vars: Record<string, string>
): EmailTemplate {
  return {
    subject: fill(template.subject, vars, (v) => v)
      .replace(/[\r\n]+/g, " ")
      .trim(),
    html: fill(template.html, vars, escapeHtml),
    text: fill(template.text, vars, (v) => v)
  };
}

export async function getEmailTemplate(
  kind: EmailKind
): Promise<EmailTemplate & { custom: boolean }> {
  const [row] = await getDb()
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.kind, kind))
    .limit(1);
  return row
    ? { subject: row.subject, html: row.html, text: row.text, custom: true }
    : { ...DEFAULT_TEMPLATES[kind], custom: false };
}

export async function saveEmailTemplate(kind: EmailKind, raw: EmailTemplate, userId: string) {
  const template = emailTemplateSchema.parse(raw);
  const values = { ...template, updatedBy: userId, updatedAt: new Date() };
  await getDb()
    .insert(emailTemplates)
    .values({ kind, ...values })
    .onConflictDoUpdate({ target: emailTemplates.kind, set: values });
}

export async function resetEmailTemplate(kind: EmailKind) {
  await getDb().delete(emailTemplates).where(eq(emailTemplates.kind, kind));
}
