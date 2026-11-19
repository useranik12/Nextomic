"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthError, AuthLink } from "@/components/auth/auth-ui";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { verifyTotp } from "@/server/auth/actions";

/** Second sign-in step for accounts with two-factor on: a code from the authenticator app. */
export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await verifyTotp({ code });
    setBusy(false);
    if (result.error) return setError(result.error);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      title="Two-factor check"
      description="Enter the 6-digit code from your authenticator app."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FormInput
          name="code"
          label="Authenticator code"
          isRequired
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          validationBehavior="aria"
          value={code}
          onValueChange={(value) => {
            setCode(value);
            setError(null);
          }}
          isInvalid={Boolean(error)}
        />
        <AuthError message={error} />
        <ActionButton type="submit" fullWidth isLoading={busy}>
          Verify
        </ActionButton>
        <AuthLink href="/sign-in">Back to sign in</AuthLink>
      </form>
    </AuthCard>
  );
}
