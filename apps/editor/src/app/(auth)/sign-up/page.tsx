"use client";

import { Button, Input, Link } from "@heroui/react";
import { useActionState } from "react";
import { signUpAction, type SignUpState } from "./actions";

const initialState: SignUpState = { error: null, success: false };

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
        <p className="text-small text-default-500">
          We sent a verification link to your inbox. Verify your email, then sign in.
        </p>
        <Link href="/sign-in" size="sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
      <Input name="name" label="Name" isRequired autoComplete="name" />
      <Input name="email" type="email" label="Email" isRequired autoComplete="email" />
      <Input
        name="password"
        type="password"
        label="Password"
        isRequired
        autoComplete="new-password"
      />
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" color="primary" isLoading={isPending}>
        Sign up
      </Button>
      <p className="text-small text-default-500">
        Already have an account?{" "}
        <Link href="/sign-in" size="sm">
          Sign in
        </Link>
      </p>
    </form>
  );
}
