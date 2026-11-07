"use server";

import type { EmailKind } from "@nextomic/db";
import { z } from "zod";
import {
  AccessDeniedError,
  canManageWorkspace,
  requireWorkspaceMembership
} from "@/lib/permissions";
import { getServerSession } from "@/lib/session";
import {
  deleteSmtpAccount,
  listSmtpAccounts,
  saveSmtpAccount,
  setDefaultSmtpAccount,
  SmtpError,
  type SmtpAccountInput,
  type SmtpAccountView
} from "@/server/mail/accounts";
import { sendTestEmail, verifySmtpAccount } from "@/server/mail/checks";
import { recentEmails, type EmailLogEntry } from "@/server/mail/queue";
import {
  EMAIL_KINDS,
  getEmailTemplate,
  resetEmailTemplate,
  saveEmailTemplate,
  type EmailTemplate
} from "@/server/mail/templates";

// SMTP settings (docs/platform.md section 4). Only workspace owners and admins may use them.

type Result<T> = { data: T; error: null } | { data: null; error: string };

const idSchema = z.string().min(1).max(100);
const kindSchema = z.enum(EMAIL_KINDS as [EmailKind, ...EmailKind[]]);

async function requireAdmin() {
  const session = await getServerSession();
  if (!session) throw new AccessDeniedError("Sign in to continue.");
  const membership = await requireWorkspaceMembership(session.user.id);
  if (!canManageWorkspace(membership.role))
    throw new AccessDeniedError("Only owners and admins can change email settings.");
  return session.user;
}

async function run<T>(
  fallback: string,
  work: (admin: { id: string; name: string; email: string }) => Promise<T>
): Promise<Result<T>> {
  try {
    return { data: await work(await requireAdmin()), error: null };
  } catch (error) {
    if (error instanceof AccessDeniedError || error instanceof SmtpError)
      return { data: null, error: error.message };
    if (error instanceof z.ZodError)
      return { data: null, error: error.issues[0]?.message ?? "Invalid input." };
    return { data: null, error: fallback };
  }
}

export async function listSmtpAccountsAction(): Promise<Result<SmtpAccountView[]>> {
  return run("Could not load the SMTP accounts.", () => listSmtpAccounts());
}

export async function saveSmtpAccountAction(
  input: SmtpAccountInput
): Promise<Result<{ id: string }>> {
  return run("Could not save the SMTP account.", async (admin) => ({
    id: await saveSmtpAccount(input, admin.id)
  }));
}

export async function deleteSmtpAccountAction(id: string): Promise<Result<null>> {
  return run("Could not delete the SMTP account.", async () => {
    await deleteSmtpAccount(idSchema.parse(id));
    return null;
  });
}

export async function setDefaultSmtpAccountAction(id: string): Promise<Result<null>> {
  return run("Could not change the default account.", async () => {
    await setDefaultSmtpAccount(idSchema.parse(id));
    return null;
  });
}

export async function testSmtpConnectionAction(id: string): Promise<Result<string>> {
  return run("The connection test failed.", () => verifySmtpAccount(idSchema.parse(id)));
}

export async function sendTestEmailAction(id: string, to: string): Promise<Result<string>> {
  return run("Could not send the test email.", (admin) =>
    sendTestEmail(
      idSchema.parse(id),
      z.string().trim().email("Enter a valid email address.").parse(to),
      admin.name
    )
  );
}

export async function recentEmailsAction(): Promise<Result<EmailLogEntry[]>> {
  return run("Could not load the email log.", () => recentEmails(50));
}

export async function getEmailTemplateAction(
  kind: string
): Promise<Result<EmailTemplate & { custom: boolean }>> {
  return run("Could not load the template.", () => getEmailTemplate(kindSchema.parse(kind)));
}

export async function saveEmailTemplateAction(
  kind: string,
  template: EmailTemplate
): Promise<Result<null>> {
  return run("Could not save the template.", async (admin) => {
    await saveEmailTemplate(kindSchema.parse(kind), template, admin.id);
    return null;
  });
}

export async function resetEmailTemplateAction(kind: string): Promise<Result<null>> {
  return run("Could not reset the template.", async () => {
    await resetEmailTemplate(kindSchema.parse(kind));
    return null;
  });
}
