"use client";

import { Chip } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import {
  disableTotp,
  startTotpEnrollment,
  verifyTotp,
  type TotpEnrollment
} from "@/server/auth/actions";

type Step = { kind: "idle" } | { kind: "scan"; enrollment: TotpEnrollment } | { kind: "disable" };

/** Two-factor sign-in with an authenticator app (TOTP). */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep({ kind: "idle" });
    setPassword("");
    setCode("");
    setError(null);
  };

  async function start() {
    setBusy(true);
    setError(null);
    const result = await startTotpEnrollment();
    setBusy(false);
    if (result.error || !result.enrollment)
      return setError(result.error ?? "Could not start two-factor setup.");
    setStep({ kind: "scan", enrollment: result.enrollment });
  }

  async function verify() {
    if (step.kind !== "scan") return;
    setBusy(true);
    setError(null);
    const result = await verifyTotp({ factorId: step.enrollment.factorId, code });
    setBusy(false);
    if (result.error) return setError(result.error);
    setOn(true);
    reset();
    router.refresh();
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    const result = await disableTotp(password);
    setBusy(false);
    if (result.error) return setError(result.error);
    setOn(false);
    reset();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            Two-factor authentication
            <Chip size="sm" variant="soft" color={on ? "success" : "default"}>
              {on ? "On" : "Off"}
            </Chip>
          </span>
          <span className="text-sm text-muted">
            Ask for a code from an authenticator app after your password.
          </span>
        </div>
        {step.kind === "idle" ? (
          on ? (
            <ActionButton
              size="sm"
              tone="danger-ghost"
              onPress={() => setStep({ kind: "disable" })}
            >
              Turn off
            </ActionButton>
          ) : (
            <ActionButton size="sm" tone="outline" isLoading={busy} onPress={() => void start()}>
              Turn on
            </ActionButton>
          )
        ) : null}
      </div>

      {step.kind === "disable" ? (
        <div className="flex flex-wrap items-end gap-2">
          <PasswordInput
            label="Confirm your password"
            autoComplete="current-password"
            value={password}
            onValueChange={(v) => {
              setPassword(v);
              setError(null);
            }}
            className="max-w-sm"
          />
          <ActionButton
            size="sm"
            tone="danger"
            isLoading={busy}
            isDisabled={!password}
            onPress={() => void turnOff()}
          >
            Turn off
          </ActionButton>
          <ActionButton size="sm" tone="ghost" onPress={reset}>
            Cancel
          </ActionButton>
        </div>
      ) : null}

      {step.kind === "scan" ? (
        <div className="flex flex-wrap items-start gap-5">
          {/* The QR code is an SVG data link made by Auth. */}
          <img
            src={step.enrollment.qrSvg}
            alt="QR code for your authenticator app"
            width={160}
            height={160}
            className="rounded-xl bg-white p-1"
          />
          <div className="flex max-w-sm flex-col gap-3">
            <p className="text-sm text-body">
              Scan the code with an authenticator app (Google Authenticator, 1Password, Authy), or
              enter this key:
            </p>
            <code className="break-all rounded-xl bg-default px-2 py-1 text-xs">
              {step.enrollment.secret}
            </code>
            <div className="flex flex-wrap items-end gap-2">
              <FormInput
                label="6-digit code"
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
                isDisabled={code.replace(/\s/g, "").length !== 6}
                onPress={() => void verify()}
              >
                Verify and turn on
              </ActionButton>
              <ActionButton size="sm" tone="ghost" onPress={reset}>
                Cancel
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
