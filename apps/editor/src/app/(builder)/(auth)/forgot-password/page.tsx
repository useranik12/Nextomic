"use client";

import { useState } from "react";
import { AuthCard, AuthError, AuthLink } from "@/components/auth/auth-ui";
import { ActionButton, FormInput } from "@/components/ui/controls";
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
        <FormInput
          name="email"
          type="email"
          label="Email"
          isRequired
          autoComplete="email"
          value={email}
          validationBehavior="aria"
          onValueChange={(value) => {
            setEmail(value);
            setError(null);
          }}
          isInvalid={Boolean(error)}
        />
        <AuthError message={error} />
        <ActionButton type="submit" fullWidth isLoading={isPending}>
          Send reset link
        </ActionButton>
        <AuthLink href="/sign-in">Back to sign in</AuthLink>
      </form>
    </AuthCard>
  );
}
