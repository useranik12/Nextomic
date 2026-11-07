"use client";

import { Spinner } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/lib/icons/Icon";

interface PasskeyRow {
  id: string;
  name?: string | null;
  createdAt?: Date | string | null;
}

const when = (value: PasskeyRow["createdAt"]) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

/** Passkeys: sign in with the device's fingerprint, face or PIN instead of a password. */
export function PasskeySettings() {
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await authClient.passkey.listUserPasskeys();
    if (result.error) return setError(result.error.message ?? "Could not load passkeys.");
    setRows((result.data ?? []) as PasskeyRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setBusy("add");
    setError(null);
    const result = await authClient.passkey.addPasskey({ name: name.trim() || "Passkey" });
    setBusy(null);
    if (result?.error) return setError(result.error.message ?? "The passkey was not added.");
    setAdding(false);
    setName("");
    void load();
  }

  async function remove(row: PasskeyRow) {
    if (!window.confirm(`Remove the passkey "${row.name ?? "Passkey"}"?`)) return;
    setBusy(row.id);
    setError(null);
    const result = await authClient.passkey.deletePasskey({ id: row.id });
    setBusy(null);
    if (result.error) return setError(result.error.message ?? "Could not remove the passkey.");
    void load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-small font-medium text-foreground">Passkeys</span>
          <span className="text-small text-default-500">
            Sign in with your fingerprint, face or device PIN.
          </span>
        </div>
        {!adding ? (
          <ActionButton
            size="sm"
            tone="ghost"
            className="border border-default-200"
            onPress={() => setAdding(true)}
          >
            <Icon name="ph:fingerprint" width={14} height={14} />
            Add passkey
          </ActionButton>
        ) : null}
      </div>
      {adding ? (
        <div className="flex flex-wrap items-end gap-2">
          <FormInput
            label="Name (optional)"
            placeholder="e.g. Work laptop"
            value={name}
            onValueChange={setName}
            className="max-w-sm"
          />
          <ActionButton size="sm" isLoading={busy === "add"} onPress={() => void add()}>
            Create passkey
          </ActionButton>
          <ActionButton size="sm" tone="ghost" onPress={() => setAdding(false)}>
            Cancel
          </ActionButton>
        </div>
      ) : null}
      {rows === null && !error ? (
        <Spinner size="sm" label="Loading passkeys" className="self-start" />
      ) : rows && rows.length > 0 ? (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 border-b border-divider py-2 last:border-b-0"
            >
              <span className="flex items-center gap-2 text-small text-foreground">
                <Icon name="ph:key" width={14} height={14} className="text-default-500" />
                {row.name || "Passkey"}
                <span className="text-tiny text-default-500">{when(row.createdAt)}</span>
              </span>
              <ActionButton
                size="sm"
                tone="danger-ghost"
                aria-label={`Remove ${row.name ?? "passkey"}`}
                isLoading={busy === row.id}
                onPress={() => void remove(row)}
              >
                <Icon name="ph:trash" width={14} height={14} />
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : rows ? (
        <p className="text-small text-default-500">No passkeys yet.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
