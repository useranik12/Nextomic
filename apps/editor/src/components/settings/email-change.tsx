"use client";

import { useState } from "react";
import { requestEmailChangeAction } from "@/app/(builder)/(dashboard)/settings/actions";
import { ActionButton, FormInput } from "@/components/ui/controls";

type Step = { kind: "idle" } | { kind: "enter" } | { kind: "code"; sentTo: string };

/** Change email: enter the new address, then open the confirmation link sent there. */
export function EmailChange({ email }: { email: string }) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const result = await requestEmailChangeAction(next);
    setBusy(false);
    if (result.data === null) return setError(result.error);
    setStep({ kind: "code", sentTo: result.data });
  }

  const cancel = () => {
    setStep({ kind: "idle" });
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">Email</span>
          <span className="text-sm text-muted">{email}</span>
        </div>
        {step.kind === "idle" ? (
          <ActionButton
            size="sm"
            tone="outline"
            onPress={() => {
              setNotice(null);
              setNext("");
              setStep({ kind: "enter" });
            }}
          >
            Change email
          </ActionButton>
        ) : null}
      </div>
      {step.kind === "enter" ? (
        <div className="flex flex-wrap items-end gap-2">
          <FormInput
            label="New email"
            type="email"
            value={next}
            onValueChange={(v) => {
              setNext(v);
              setError(null);
            }}
            className="max-w-sm"
            autoComplete="email"
          />
          <ActionButton
            size="sm"
            isLoading={busy}
            isDisabled={!next.trim()}
            onPress={() => void send()}
          >
            Send link
          </ActionButton>
          <ActionButton size="sm" tone="ghost" onPress={cancel}>
            Cancel
          </ActionButton>
        </div>
      ) : null}
      {step.kind === "code" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-body">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{step.sentTo}</span>. Open it to finish
            the change; your email stays as it is until then.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton size="sm" tone="ghost" isDisabled={busy} onPress={() => void send()}>
              Resend
            </ActionButton>
            <ActionButton size="sm" tone="ghost" onPress={cancel}>
              Done
            </ActionButton>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
