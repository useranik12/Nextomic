"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  confirmEmailChangeAction,
  requestEmailChangeAction
} from "@/app/(builder)/(dashboard)/settings/actions";
import { ActionButton, FormInput } from "@/components/ui/controls";

type Step = { kind: "idle" } | { kind: "enter" } | { kind: "code"; sentTo: string };

/** Change email: enter the new address, get a 6-digit code there, confirm it. */
export function EmailChange({ email }: { email: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(email);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const result = await requestEmailChangeAction(next);
    setBusy(false);
    if (result.data === null) return setError(result.error);
    setCode("");
    setStep({ kind: "code", sentTo: result.data });
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await confirmEmailChangeAction(code);
    setBusy(false);
    if (result.data === null) return setError(result.error);
    setCurrent(result.data);
    setStep({ kind: "idle" });
    setNotice(`Your email is now ${result.data}.`);
    router.refresh();
  }

  const cancel = () => {
    setStep({ kind: "idle" });
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-small font-medium text-foreground">Email</span>
          <span className="text-small text-default-500">{current}</span>
        </div>
        {step.kind === "idle" ? (
          <ActionButton
            size="sm"
            tone="ghost"
            className="border border-default-200"
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
            Send code
          </ActionButton>
          <ActionButton size="sm" tone="ghost" onPress={cancel}>
            Cancel
          </ActionButton>
        </div>
      ) : null}
      {step.kind === "code" ? (
        <div className="flex flex-col gap-2">
          <p className="text-small text-default-600">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{step.sentTo}</span>. It expires in 10
            minutes.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <FormInput
              label="Code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onValueChange={(v) => {
                setCode(v);
                setError(null);
              }}
              className="max-w-40"
            />
            <ActionButton
              size="sm"
              isLoading={busy}
              isDisabled={code.trim().length !== 6}
              onPress={() => void confirm()}
            >
              Confirm and save
            </ActionButton>
            <ActionButton size="sm" tone="ghost" isDisabled={busy} onPress={() => void send()}>
              Resend
            </ActionButton>
            <ActionButton size="sm" tone="ghost" onPress={cancel}>
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-small text-success">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
