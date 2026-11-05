"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AuthButton,
  AuthCard,
  AuthError,
  AuthLink,
  PasswordInput
} from "@/components/auth/auth-ui";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
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
          value={newPassword}
          onValueChange={setNewPassword}
          isInvalid={Boolean(error)}
        />
        <AuthError message={error} />
        <AuthButton isLoading={isPending}>Reset password</AuthButton>
        <AuthLink href="/sign-in">Back to sign in</AuthLink>
      </form>
    </AuthCard>
  );
}
