"use client";

import { useActionState, useState } from "react";
import { signUpAction, type SignUpState } from "@/app/(builder)/(auth)/sign-up/actions";
import { AuthCard, AuthError, AuthLink } from "@/components/auth/auth-ui";
import { PasswordStrength } from "@/components/auth/password-strength";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { passwordProblem, type PasswordPolicy } from "@/lib/password-policy";

const initialState: SignUpState = { error: null, success: false };

/** Sign-up with a live strength meter; Sign up turns on once the password meets the policy. */
export function SignUpForm({ policy }: { policy: PasswordPolicy }) {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const [password, setPassword] = useState("");
  // The server error belongs to the attempt that caused it; editing a field hides it.
  const [shownError, setShownError] = useState<SignUpState | null>(null);
  const error = shownError === state ? null : state.error;

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

  const hide = () => setShownError(state);
  const allowed = passwordProblem(password, policy) === null;

  return (
    <AuthCard title="Create your account" description="Start building with Nextomic.">
      <form action={formAction} className="flex flex-col gap-5">
        <FormInput
          name="name"
          label="Name"
          isRequired
          autoComplete="name"
          validationBehavior="aria"
          onValueChange={hide}
          isInvalid={Boolean(error)}
        />
        <FormInput
          name="email"
          type="email"
          label="Email"
          isRequired
          autoComplete="email"
          validationBehavior="aria"
          onValueChange={hide}
          isInvalid={Boolean(error)}
        />
        <div className="flex flex-col gap-2">
          <PasswordInput
            name="password"
            label="Password"
            isRequired
            autoComplete="new-password"
            validationBehavior="aria"
            value={password}
            onValueChange={(value) => {
              setPassword(value);
              hide();
            }}
            isInvalid={Boolean(error)}
          />
          <PasswordStrength password={password} policy={policy} />
        </div>
        <AuthError message={error} />
        <ActionButton type="submit" fullWidth isLoading={isPending} isDisabled={!allowed}>
          Sign up
        </ActionButton>
        <p className="text-sm text-muted">
          Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
        </p>
      </form>
    </AuthCard>
  );
}
