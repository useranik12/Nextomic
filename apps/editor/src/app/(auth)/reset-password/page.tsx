"use client";

import { Button, Input, Link } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Choose a new password</h1>
      <Input
        name="newPassword"
        type="password"
        label="New password"
        isRequired
        autoComplete="new-password"
        value={newPassword}
        onValueChange={setNewPassword}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" color="primary" isLoading={isPending}>
        Reset password
      </Button>
      <Link href="/sign-in" size="sm">
        Back to sign in
      </Link>
    </form>
  );
}
