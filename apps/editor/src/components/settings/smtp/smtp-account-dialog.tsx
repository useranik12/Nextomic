"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState } from "react";
import { saveSmtpAccountAction } from "@/app/(builder)/(dashboard)/settings/smtp-actions";
import { ActionButton, FormInput, PasswordInput, SelectField } from "@/components/ui/controls";
import type { SmtpAccountView } from "@/server/mail/accounts";

const SECURITY = [
  { value: "starttls", label: "STARTTLS (usually port 587)" },
  { value: "tls", label: "TLS (usually port 465)" },
  { value: "none", label: "None (upgrade when offered)" }
];
const PORT_FOR: Record<string, string> = { starttls: "587", tls: "465", none: "25" };

interface Draft {
  name: string;
  host: string;
  port: string;
  security: "tls" | "starttls" | "none";
  username: string;
  password: string;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  rateLimit: string;
}

const draftOf = (a: SmtpAccountView | null): Draft => ({
  name: a?.name ?? "",
  host: a?.host ?? "",
  port: String(a?.port ?? 587),
  security: a?.security ?? "starttls",
  username: a?.username ?? "",
  password: "",
  fromName: a?.fromName ?? "Nextomic",
  fromAddress: a?.fromAddress ?? "",
  replyTo: a?.replyTo ?? "",
  rateLimit: a?.rateLimitPerMinute ? String(a.rateLimitPerMinute) : ""
});

/** Add or edit a saved SMTP account. A blank password keeps the saved one. */
export function SmtpAccountDialog({
  account,
  onSaved,
  onClose
}: {
  account: SmtpAccountView | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(account));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveSmtpAccountAction({
      id: account?.id,
      name: draft.name,
      host: draft.host,
      port: Number(draft.port),
      security: draft.security,
      username: draft.username,
      password: draft.password,
      fromName: draft.fromName,
      fromAddress: draft.fromAddress,
      replyTo: draft.replyTo,
      rateLimitPerMinute: draft.rateLimit ? Number(draft.rateLimit) : null
    });
    setBusy(false);
    if (result.error) setError(result.error);
    else onSaved();
  }

  return (
    <Modal isOpen onClose={onClose} backdrop="blur" size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{account ? `Edit ${account.name}` : "Add SMTP account"}</ModalHeader>
        <ModalBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            label="Name"
            value={draft.name}
            onValueChange={(v) => set("name", v)}
            isRequired
            className="sm:col-span-2"
          />
          <FormInput
            label="Host"
            placeholder="smtp.example.com"
            value={draft.host}
            onValueChange={(v) => set("host", v)}
            isRequired
          />
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_6rem] items-end gap-3">
            <SelectField
              className="min-w-0"
              label="Security"
              options={SECURITY}
              value={draft.security}
              onValueChange={(v) => {
                const next = v as Draft["security"];
                setDraft((d) => ({
                  ...d,
                  security: next,
                  port: d.port === PORT_FOR[d.security] ? (PORT_FOR[next] ?? d.port) : d.port
                }));
              }}
            />
            <FormInput
              label="Port"
              type="number"
              value={draft.port}
              onValueChange={(v) => set("port", v)}
              isRequired
            />
          </div>
          <FormInput
            label="Username"
            autoComplete="off"
            value={draft.username}
            onValueChange={(v) => set("username", v)}
          />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            placeholder={account?.hasPassword ? "Saved. Leave blank to keep it." : " "}
            value={draft.password}
            onValueChange={(v) => set("password", v)}
          />
          <FormInput
            label="From name"
            value={draft.fromName}
            onValueChange={(v) => set("fromName", v)}
            isRequired
          />
          <FormInput
            label="From address"
            type="email"
            value={draft.fromAddress}
            onValueChange={(v) => set("fromAddress", v)}
            isRequired
          />
          <FormInput
            label="Reply-to (optional)"
            type="email"
            value={draft.replyTo}
            onValueChange={(v) => set("replyTo", v)}
          />
          <FormInput
            label="Rate limit per minute (optional)"
            type="number"
            placeholder="No limit"
            value={draft.rateLimit}
            onValueChange={(v) => set("rateLimit", v)}
          />
          <p className="text-tiny text-default-500 sm:col-span-2">
            The password is encrypted before it is saved and is never shown again.
          </p>
          {error ? (
            <p role="alert" className="text-small text-danger sm:col-span-2">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <ActionButton tone="ghost" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton isLoading={busy} onPress={() => void save()}>
            Save account
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
