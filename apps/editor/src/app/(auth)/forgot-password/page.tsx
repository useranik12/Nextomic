"use client";

import { useState } from "react";
import { AuthButton, AuthCard, AuthError, AuthInput, AuthLink } from "@/components/auth/auth-ui";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const { error: requestError } = await authClient.forgetPassword({
      email,
      redirectTo: "/reset-password"
    });
    setIsPending(false);
    if (requestError) {
      setError(requestError.message ?? "Could not request a reset link.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description={`If an account exists for ${email}, a reset link is on its way.`}
      >
        <AuthLink href="/sign-in">Back to sign in</AuthLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we will send you a reset link."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthInput
          name="email"
          type="email"
          label="Email"
          isRequired
          autoComplete="email"
          value={email}
          onValueChange={setEmail}
          isInvalid={Boolean(error)}
        />
        <AuthError message={error} />
        <AuthButton isLoading={isPending}>Send reset link</AuthButton>
        <AuthLink href="/sign-in">Back to sign in</AuthLink>
      </form>
    </AuthCard>
  );
}
