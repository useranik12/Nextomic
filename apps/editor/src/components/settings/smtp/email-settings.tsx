"use client";

import { Spinner } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import {
  listSmtpAccountsAction,
  recentEmailsAction
} from "@/app/(builder)/(dashboard)/settings/smtp-actions";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import type { SmtpAccountView } from "@/server/mail/accounts";
import type { EmailLogEntry } from "@/server/mail/queue";
import { EmailLog } from "./email-log";
import { SendTestDialog } from "./send-test-dialog";
import { SmtpAccountDialog } from "./smtp-account-dialog";
import { SmtpAccountRow } from "./smtp-account-row";
import { TemplateDialog } from "./template-dialog";

export interface TemplateInfo {
  kind: string;
  label: string;
  variables: { name: string; description: string }[];
}

type Editing = { account: SmtpAccountView | null } | null;

/** SMTP accounts, email templates and the email log (owners and admins only). */
export function EmailSettings({
  adminEmail,
  templates
}: {
  adminEmail: string;
  templates: TemplateInfo[];
}) {
  const [accounts, setAccounts] = useState<SmtpAccountView[] | null>(null);
  const [log, setLog] = useState<EmailLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [testing, setTesting] = useState<SmtpAccountView | null>(null);
  const [template, setTemplate] = useState<TemplateInfo | null>(null);

  const load = useCallback(async () => {
    const [list, recent] = await Promise.all([listSmtpAccountsAction(), recentEmailsAction()]);
    if (list.data === null) setError(list.error);
    else {
      setError(null);
      setAccounts(list.data);
    }
    if (recent.data !== null) setLog(recent.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const names = Object.fromEntries((accounts ?? []).map((a) => [a.id, a.name]));
  const kindLabels = Object.fromEntries(templates.map((t) => [t.kind, t.label]));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-medium font-semibold text-foreground">SMTP accounts</h3>
          <ActionButton size="sm" onPress={() => setEditing({ account: null })}>
            <Icon name="ph:plus" width={14} height={14} />
            Add SMTP account
          </ActionButton>
        </div>
        <p className="text-small text-default-500">
          The default account sends sign-up verification, password reset and other platform email.
        </p>
        <div className="rounded-large border border-default-100 bg-content1/40 px-5">
          {accounts === null && !error ? (
            <div className="py-6">
              <Spinner size="sm" label="Loading accounts" />
            </div>
          ) : error ? (
            <p role="alert" className="py-6 text-small text-danger">
              {error}
            </p>
          ) : accounts && accounts.length > 0 ? (
            <ul>
              {accounts.map((a) => (
                <SmtpAccountRow
                  key={a.id}
                  account={a}
                  onEdit={() => setEditing({ account: a })}
                  onSendTest={() => setTesting(a)}
                  onChanged={() => void load()}
                />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-small text-default-500">
              No SMTP account yet. Add one, or set the SMTP_* variables in Dokploy. Until then, no
              email can be sent.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-medium font-semibold text-foreground">Email templates</h3>
        <ul className="rounded-large border border-default-100 bg-content1/40 px-5">
          {templates.map((t) => (
            <li
              key={t.kind}
              className="flex items-center justify-between gap-3 border-b border-divider py-3 last:border-b-0"
            >
              <span className="text-small text-foreground">{t.label}</span>
              <ActionButton size="sm" tone="ghost" onPress={() => setTemplate(t)}>
                <Icon name="ph:pencil-simple" width={14} height={14} />
                Edit
              </ActionButton>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-medium font-semibold text-foreground">Recent emails</h3>
          <ActionButton size="sm" tone="ghost" onPress={() => void load()}>
            Refresh
          </ActionButton>
        </div>
        <div className="rounded-large border border-default-100 bg-content1/40 px-5">
          <EmailLog entries={log} accountNames={names} kindLabels={kindLabels} />
        </div>
      </div>

      {editing ? (
        <SmtpAccountDialog
          account={editing.account}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
      {testing ? (
        <SendTestDialog
          accountId={testing.id}
          accountName={testing.name}
          defaultTo={adminEmail}
          onSent={() => void load()}
          onClose={() => setTesting(null)}
        />
      ) : null}
      {template ? (
        <TemplateDialog
          kind={template.kind}
          label={template.label}
          variables={template.variables}
          onClose={() => setTemplate(null)}
        />
      ) : null}
    </div>
  );
}
