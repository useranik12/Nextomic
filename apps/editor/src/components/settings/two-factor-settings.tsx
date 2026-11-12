"use client";

import { Chip } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { renderSVG } from "uqr";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { authClient } from "@/lib/auth-client";

type Step =
  | { kind: "idle" }
  | { kind: "password"; action: "enable" | "disable" | "codes" }
  | { kind: "scan"; uri: string; backupCodes: string[] }
  | { kind: "codes"; backupCodes: string[] };

const qrSource = (uri: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(uri, { border: 2 }))}`;

/** Two-factor sign-in with an authenticator app (TOTP) and backup codes. */
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

  async function withPassword(action: "enable" | "disable" | "codes") {
    setBusy(true);
    setError(null);
    if (action === "enable") {
      const result = await authClient.twoFactor.enable({ password });
      setBusy(false);
      if (result.error || !result.data)
        return setError(result.error?.message ?? "Could not start two-factor setup.");
      setPassword("");
      return setStep({
        kind: "scan",
        uri: result.data.totpURI,
        backupCodes: result.data.backupCodes
      });
    }
    if (action === "disable") {
      const result = await authClient.twoFactor.disable({ password });
      setBusy(false);
      if (result.error) return setError(result.error.message ?? "Could not turn off two-factor.");
      setOn(false);
      reset();
      return router.refresh();
    }
    const result = await authClient.twoFactor.generateBackupCodes({ password });
    setBusy(false);
    if (result.error || !result.data)
      return setError(result.error?.message ?? "Could not make new backup codes.");
    setPassword("");
    setStep({ kind: "codes", backupCodes: result.data.backupCodes });
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const result = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
    setBusy(false);
    if (result.error) return setError(result.error.message ?? "That code did not work.");
    setOn(true);
    if (step.kind === "scan") setStep({ kind: "codes", backupCodes: step.backupCodes });
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
          <div className="flex gap-2">
            {on ? (
              <>
                <ActionButton
                  size="sm"
                  tone="outline"
                  onPress={() => setStep({ kind: "password", action: "codes" })}
                >
                  New backup codes
                </ActionButton>
                <ActionButton
                  size="sm"
                  tone="danger-ghost"
                  onPress={() => setStep({ kind: "password", action: "disable" })}
                >
                  Turn off
                </ActionButton>
              </>
            ) : (
              <ActionButton
                size="sm"
                tone="outline"
                onPress={() => setStep({ kind: "password", action: "enable" })}
              >
                Turn on
              </ActionButton>
            )}
          </div>
        ) : null}
      </div>

      {step.kind === "password" ? (
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
            isLoading={busy}
            isDisabled={!password}
            onPress={() => void withPassword(step.action)}
          >
            Continue
          </ActionButton>
          <ActionButton size="sm" tone="ghost" onPress={reset}>
            Cancel
          </ActionButton>
        </div>
      ) : null}

      {step.kind === "scan" ? (
        <div className="flex flex-wrap items-start gap-5">
          <img
            src={qrSource(step.uri)}
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
              {new URL(step.uri).searchParams.get("secret")}
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

      {step.kind === "codes" ? (
        <div className="flex max-w-md flex-col gap-2">
          <p className="text-sm text-body">
            Save these backup codes somewhere safe. Each works once if you lose your authenticator.
            They are not shown again.
          </p>
          <ul className="grid grid-cols-2 gap-1 rounded-xl bg-default p-3 font-mono text-sm">
            {step.backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <ActionButton
              size="sm"
              tone="outline"
              onPress={() => void navigator.clipboard.writeText(step.backupCodes.join("\n"))}
            >
              Copy codes
            </ActionButton>
            <ActionButton size="sm" onPress={reset}>
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
    </div>
  );
}
