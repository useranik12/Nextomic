"use client";

import { Button, Input, Link } from "@heroui/react";
import { useState } from "react";
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
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
        <p className="text-small text-default-500">
          If an account exists for {email}, a reset link is on its way.
        </p>
        <Link href="/sign-in" size="sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
      <Input
        name="email"
        type="email"
        label="Email"
        isRequired
        autoComplete="email"
        value={email}
        onValueChange={setEmail}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" color="primary" isLoading={isPending}>
        Send reset link
      </Button>
      <Link href="/sign-in" size="sm">
        Back to sign in
      </Link>
    </form>
  );
}
