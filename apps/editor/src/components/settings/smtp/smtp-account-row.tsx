"use client";

import { Chip } from "@heroui/react";
import { useState } from "react";
import {
  deleteSmtpAccountAction,
  setDefaultSmtpAccountAction,
  testSmtpConnectionAction
} from "@/app/(builder)/(dashboard)/settings/smtp-actions";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import type { SmtpAccountView } from "@/server/mail/accounts";

const SECURITY_LABEL = { tls: "TLS", starttls: "STARTTLS", none: "No TLS" } as const;

/** One SMTP account with its actions: test connection, send test, make default, edit, delete. */
export function SmtpAccountRow({
  account,
  onEdit,
  onSendTest,
  onChanged
}: {
  account: SmtpAccountView;
  onEdit: () => void;
  onSendTest: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const saved = account.source === "saved";

  async function act(
    key: string,
    work: () => Promise<{ error: string | null; data?: unknown }>,
    done?: string
  ) {
    setBusy(key);
    setMessage(null);
    const result = await work();
    setBusy(null);
    if (result.error) setMessage({ ok: false, text: result.error });
    else {
      if (typeof result.data === "string") setMessage({ ok: true, text: result.data });
      else if (done) setMessage({ ok: true, text: done });
      onChanged();
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-divider py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-foreground">{account.name}</span>
            {account.isDefault ? (
              <Chip size="sm" variant="flat" color="success">
                Default
              </Chip>
            ) : null}
            {!saved ? (
              <Chip size="sm" variant="flat">
                From Dokploy environment
              </Chip>
            ) : null}
          </div>
          <span className="truncate text-tiny text-default-500">
            {account.host}:{account.port} · {SECURITY_LABEL[account.security]} · {account.fromName}{" "}
            &lt;
            {account.fromAddress}&gt;
            {account.rateLimitPerMinute ? ` · ${account.rateLimitPerMinute}/min` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ActionButton
            size="sm"
            tone="ghost"
            isLoading={busy === "test"}
            onPress={() => void act("test", () => testSmtpConnectionAction(account.id))}
          >
            <Icon name="ph:plugs-connected" width={14} height={14} />
            Test connection
          </ActionButton>
          <ActionButton size="sm" tone="ghost" onPress={onSendTest}>
            Send test email
          </ActionButton>
          {!account.isDefault ? (
            <ActionButton
              size="sm"
              tone="ghost"
              isLoading={busy === "default"}
              onPress={() =>
                void act(
                  "default",
                  () => setDefaultSmtpAccountAction(account.id),
                  "Now the default account."
                )
              }
            >
              Make default
            </ActionButton>
          ) : null}
          {saved ? (
            <>
              <ActionButton
                size="sm"
                tone="ghost"
                aria-label={`Edit ${account.name}`}
                onPress={onEdit}
              >
                <Icon name="ph:pencil-simple" width={14} height={14} />
              </ActionButton>
              <ActionButton
                size="sm"
                tone="danger-ghost"
                aria-label={`Delete ${account.name}`}
                isLoading={busy === "delete"}
                onPress={() => {
                  if (window.confirm(`Delete the SMTP account "${account.name}"?`))
                    void act("delete", () => deleteSmtpAccountAction(account.id));
                }}
              >
                <Icon name="ph:trash" width={14} height={14} />
              </ActionButton>
            </>
          ) : null}
        </div>
      </div>
      {message ? (
        <p
          role={message.ok ? "status" : "alert"}
          className={`text-tiny ${message.ok ? "text-success" : "text-danger"}`}
        >
          {message.text}
        </p>
      ) : null}
    </li>
  );
}
