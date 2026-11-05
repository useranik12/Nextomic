"use client";

import { Button, Input, Link } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
      <Input
        name="email"
        type="email"
        label="Email"
        isRequired
        autoComplete="email"
        value={email}
        onValueChange={setEmail}
      />
      <Input
        name="password"
        type="password"
        label="Password"
        isRequired
        autoComplete="current-password"
        value={password}
        onValueChange={setPassword}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" color="primary" isLoading={isPending}>
        Sign in
      </Button>
      <div className="flex justify-between text-small text-default-500">
        <Link href="/sign-up" size="sm">
          Create an account
        </Link>
        <Link href="/forgot-password" size="sm">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
