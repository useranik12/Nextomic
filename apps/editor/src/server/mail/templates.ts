import type { EmailKind } from "@nextomic/db";

// Platform email templates: subject, HTML and plain text with {{variable}} placeholders. Values
// are HTML-escaped in the HTML part and line breaks are removed from the subject.

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

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
  }
};

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
