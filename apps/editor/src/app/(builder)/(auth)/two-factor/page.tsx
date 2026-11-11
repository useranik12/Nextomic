"use client";

import { Checkbox } from "@heroui-v2/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthError, AuthLink } from "@/components/auth/auth-ui";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { authClient } from "@/lib/auth-client";

/** Second sign-in step for accounts with two-factor on: an authenticator or a backup code. */
export default function TwoFactorPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice })
        : await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice });
    setBusy(false);
    if (result.error) return setError(result.error.message ?? "That code did not work.");
    router.push("/dashboard");
    router.refresh();
  }

  const switchMode = () => {
    setMode(mode === "totp" ? "backup" : "totp");
    setCode("");
    setError(null);
  };

  return (
    <AuthCard
      title="Two-factor check"
      description={
        mode === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter one of your backup codes. Each code works once."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FormInput
          name="code"
          label={mode === "totp" ? "Authenticator code" : "Backup code"}
          isRequired
          autoFocus
          autoComplete="one-time-code"
          inputMode={mode === "totp" ? "numeric" : "text"}
          validationBehavior="aria"
          value={code}
          onValueChange={(value) => {
            setCode(value);
            setError(null);
          }}
          isInvalid={Boolean(error)}
        />
        <Checkbox size="sm" isSelected={trustDevice} onValueChange={setTrustDevice}>
          <span className="text-small text-default-600">
            Trust this device (skip this step here next time)
          </span>
        </Checkbox>
        <AuthError message={error} />
        <ActionButton type="submit" fullWidth isLoading={busy}>
          Verify
        </ActionButton>
        <div className="flex justify-between">
          <AuthLink as="button" type="button" onPress={switchMode}>
            {mode === "totp" ? "Use a backup code" : "Use the authenticator app"}
          </AuthLink>
          <AuthLink href="/sign-in">Back to sign in</AuthLink>
        </div>
      </form>
    </AuthCard>
  );
}
