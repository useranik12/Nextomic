"use client";

import { useCallback, useEffect, useState } from "react";
import { Busy } from "@/components/ui/busy";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { createPasskey, passkeysSupported } from "@/lib/passkey-browser";
import {
  deletePasskey,
  listPasskeys,
  passkeyRegistrationOptions,
  passkeyRegistrationVerify,
  renamePasskey
} from "@/server/auth/actions";

interface PasskeyRow {
  id: string;
  name: string;
  createdAt: string;
}

const when = (value: string) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";

/** Passkeys: sign in with the device's fingerprint, face or PIN instead of a password. */
export function PasskeySettings() {
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listPasskeys());
    } catch {
      setRows([]);
      setError("Could not load your passkeys.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const start = await passkeyRegistrationOptions();
      if (start.error !== null) throw new Error(start.error);
      const credential = await createPasskey(start.options);
      const done = await passkeyRegistrationVerify({ challengeId: start.challengeId, credential });
      if (done.error) throw new Error(done.error);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the passkey.");
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const result = await renamePasskey(editing.id, editing.name);
    setBusy(false);
    if (result.error) return setError(result.error);
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const result = await deletePasskey(id);
    setBusy(false);
    if (result.error) return setError(result.error);
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">Passkeys</span>
          <span className="text-sm text-muted">
            Sign in with your fingerprint, face or device PIN instead of a password.
          </span>
        </div>
        <ActionButton
          size="sm"
          tone="outline"
          isLoading={busy && !editing}
          isDisabled={!passkeysSupported()}
          onPress={() => void add()}
        >
          <Icon name="ph:fingerprint" width={16} height={16} />
          Add a passkey
        </ActionButton>
      </div>

      {rows === null ? (
        <Busy label="Loading passkeys" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No passkeys yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              {editing?.id === row.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <FormInput
                    compact
                    label="Name"
                    value={editing.name}
                    onValueChange={(name) => setEditing({ id: row.id, name })}
                  />
                  <ActionButton size="sm" isLoading={busy} onPress={() => void rename()}>
                    Save
                  </ActionButton>
                  <ActionButton size="sm" tone="ghost" onPress={() => setEditing(null)}>
                    Cancel
                  </ActionButton>
                </div>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground">{row.name}</span>
                    <span className="text-xs text-muted">Added {when(row.createdAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    <ActionButton
                      size="sm"
                      tone="ghost"
                      onPress={() => setEditing({ id: row.id, name: row.name })}
                    >
                      Rename
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      tone="danger-ghost"
                      isDisabled={busy}
                      onPress={() => void remove(row.id)}
                    >
                      Remove
                    </ActionButton>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
