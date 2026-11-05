"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthError, AuthLink } from "@/components/auth/auth-ui";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setIsPending(false);
    if (signInError) {
      setError(signInError.message ?? "Could not sign in.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard title="Welcome back" description="Sign in to continue to Nextomic.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FormInput
          name="email"
          type="email"
          label="Email"
          isRequired
          autoComplete="email"
          value={email}
          onValueChange={setEmail}
          isInvalid={Boolean(error)}
        />
        <PasswordInput
          name="password"
          label="Password"
          isRequired
          autoComplete="current-password"
          value={password}
          onValueChange={setPassword}
          isInvalid={Boolean(error)}
        />
        <AuthError message={error} />
        <ActionButton type="submit" fullWidth isLoading={isPending}>
          Sign in
        </ActionButton>
        <div className="flex justify-between">
          <AuthLink href="/sign-up">Create an account</AuthLink>
          <AuthLink href="/forgot-password">Forgot password?</AuthLink>
        </div>
      </form>
    </AuthCard>
  );
}
