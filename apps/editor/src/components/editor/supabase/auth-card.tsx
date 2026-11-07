"use client";

import { Switch } from "@heroui/react";
import { useState } from "react";
import { ActionButton, PasswordInput } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";
import { SupabaseCard } from "./supabase-page";
import { authOf, type SupabasePageModel } from "./use-supabase-page";

/** Supabase auth providers for the built app. Public values only; saved with Save. */
export function AuthCard({ model }: { model: SupabasePageModel }) {
  const saved = authOf(model.connector?.config);
  const appAuth = useEditorStore((s) => s.project.appAuth);
  const supabaseAuthOn = appAuth.enabled && appAuth.provider === "supabase";
  const [enabled, setEnabled] = useState(saved.google.enabled);
  const [clientId, setClientId] = useState(saved.google.webClientId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = enabled !== saved.google.enabled || clientId.trim() !== saved.google.webClientId;
  const missingId = enabled && clientId.trim() === "";

  async function save() {
    setBusy(true);
    setError(null);
    const result = await model.save({
      auth: { google: { enabled, webClientId: clientId.trim() } }
    });
    setBusy(false);
    if (result.data === null) return setError(result.error);
    setNotice("Authentication settings saved.");
  }

  return (
    <SupabaseCard
      title="Authentication"
      description="Supabase authentication for the app. Works only if Supabase Authentication is selected in App Settings."
    >
      {!supabaseAuthOn ? (
        <p className="text-small text-warning">
          Not in use: turn on authentication with the Supabase method in App Settings.
        </p>
      ) : null}
      {!model.connector ? (
        <p className="text-small text-default-500">Connect Supabase first.</p>
      ) : (
        <>
          <Switch
            size="sm"
            isSelected={enabled}
            onValueChange={(on) => {
              setEnabled(on);
              setNotice(null);
            }}
          >
            <span className="text-small">Google Authentication</span>
          </Switch>
          {enabled ? (
            <PasswordInput
              label="Web Client ID"
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setNotice(null);
              }}
              className="max-w-sm"
              autoComplete="off"
              isInvalid={missingId}
              errorMessage={missingId ? "Enter the Google Web Client ID." : undefined}
              validationBehavior="aria"
            />
          ) : null}
          {dirty ? (
            <div className="flex gap-2">
              <ActionButton
                size="sm"
                isLoading={busy}
                isDisabled={missingId}
                onPress={() => void save()}
              >
                Save
              </ActionButton>
              <ActionButton
                size="sm"
                tone="ghost"
                isDisabled={busy}
                onPress={() => {
                  setEnabled(saved.google.enabled);
                  setClientId(saved.google.webClientId);
                  setError(null);
                }}
              >
                Discard
              </ActionButton>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
          {notice && !dirty ? (
            <p role="status" className="text-small text-success">
              {notice}
            </p>
          ) : null}
        </>
      )}
    </SupabaseCard>
  );
}
