"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, AuthError, AuthLink } from "@/components/auth/auth-ui";
import { PasswordStrength } from "@/components/auth/password-strength";
import { ActionButton, PasswordInput } from "@/components/ui/controls";
import { authClient } from "@/lib/auth-client";
import { passwordProblem, type PasswordPolicy } from "@/lib/password-policy";

export function ResetPasswordView({ policy }: { policy: PasswordPolicy }) {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm policy={policy} />
    </Suspense>
  );
}

function ResetPasswordForm({ policy }: { policy: PasswordPolicy }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    setError(null);
    setIsPending(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword, token });
    setIsPending(false);
    if (resetError) {
      setError(resetError.message ?? "Could not reset your password.");
      return;
    }
    router.push("/sign-in");
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick a strong password you have not used before."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <PasswordInput
          name="newPassword"
          label="New password"
          isRequired
          autoComplete="new-password"
          validationBehavior="aria"
          value={newPassword}
          onValueChange={(value) => {
            setNewPassword(value);
            setError(null);
          }}
          isInvalid={Boolean(error)}
        />
        <PasswordStrength password={newPassword} policy={policy} />
        <AuthError message={error} />
        <ActionButton
          type="submit"
          fullWidth
          isLoading={isPending}
          isDisabled={passwordProblem(newPassword, policy) !== null}
        >
          Reset password
        </ActionButton>
        <AuthLink href="/sign-in">Back to sign in</AuthLink>
      </form>
    </AuthCard>
  );
}
