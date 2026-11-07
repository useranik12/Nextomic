"use client";

import { useState } from "react";
import { PasswordStrength } from "@/components/auth/password-strength";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { authClient } from "@/lib/auth-client";
import { passwordProblem, type PasswordPolicy } from "@/lib/password-policy";

/** Change password: a code is emailed to the account, then code + new password are saved. */
export function PasswordChange({ email, policy }: { email: string; policy: PasswordPolicy }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"send" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send() {
    setBusy("send");
    setError(null);
    setNotice(null);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "forget-password"
    });
    setBusy(null);
    if (result.error) return setError(result.error.message ?? "Could not send the code.");
    setSent(true);
  }

  async function save() {
    setBusy("save");
    setError(null);
    const result = await authClient.emailOtp.resetPassword({ email, otp: code.trim(), password });
    setBusy(null);
    if (result.error) return setError(result.error.message ?? "Could not change the password.");
    setSent(false);
    setCode("");
    setPassword("");
    setNotice("Password changed.");
  }

  const clear = (set: (v: string) => void) => (value: string) => {
    set(value);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-small font-medium text-foreground">Password</span>
          <span className="text-small text-default-500">
            We email a 6-digit code to {email} to confirm the change.
          </span>
        </div>
        {!sent ? (
          <ActionButton
            size="sm"
            tone="ghost"
            className="border border-default-200"
            isLoading={busy === "send"}
            onPress={() => void send()}
          >
            Send code
          </ActionButton>
        ) : null}
      </div>
      {sent ? (
        <div className="flex max-w-md flex-col gap-3">
          <FormInput
            label="Code from the email"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onValueChange={clear(setCode)}
          />
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={password}
            onValueChange={clear(setPassword)}
          />
          <PasswordStrength password={password} policy={policy} />
          <div className="flex items-center gap-2">
            <ActionButton
              size="sm"
              isLoading={busy === "save"}
              isDisabled={code.trim().length !== 6 || passwordProblem(password, policy) !== null}
              onPress={() => void save()}
            >
              Save password
            </ActionButton>
            <ActionButton
              size="sm"
              tone="ghost"
              isDisabled={busy !== null}
              onPress={() => void send()}
            >
              Resend
            </ActionButton>
            <ActionButton
              size="sm"
              tone="ghost"
              onPress={() => {
                setSent(false);
                setError(null);
              }}
            >
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
