"use client";

import { useActionState } from "react";
import { AuthCard, AuthError, AuthLink } from "@/components/auth/auth-ui";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { signUpAction, type SignUpState } from "./actions";

const initialState: SignUpState = { error: null, success: false };

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);

  if (state.success) {
    return (
      <AuthCard
        title="Check your email"
        description="We sent a verification link to your inbox. Verify your email, then sign in."
      >
        <AuthLink href="/sign-in">Back to sign in</AuthLink>
      </AuthCard>
    );
  }

  const hasError = Boolean(state.error);

  return (
    <AuthCard title="Create your account" description="Start building with Nextomic.">
      <form action={formAction} className="flex flex-col gap-5">
        <FormInput name="name" label="Name" isRequired autoComplete="name" isInvalid={hasError} />
        <FormInput
          name="email"
          type="email"
          label="Email"
          isRequired
          autoComplete="email"
          isInvalid={hasError}
        />
        <PasswordInput
          name="password"
          label="Password"
          isRequired
          autoComplete="new-password"
          isInvalid={hasError}
        />
        <AuthError message={state.error} />
        <ActionButton type="submit" fullWidth isLoading={isPending}>
          Sign up
        </ActionButton>
        <p className="text-small text-default-500">
          Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
        </p>
      </form>
    </AuthCard>
  );
}
