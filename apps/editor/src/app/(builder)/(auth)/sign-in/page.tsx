"use client";

import { Checkbox, Divider } from "@heroui-v2/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthError, AuthLink, AuthNotice } from "@/components/auth/auth-ui";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/lib/icons/Icon";

type Busy = "password" | "magic" | "passkey" | null;

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  // Any new input clears the last error, so the form is ready to send again.
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    setError(null);
  };

  const finish = () => {
    router.push("/dashboard");
    router.refresh();
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("password");
    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
      rememberMe
    });
    setBusy(null);
    if (signInError) return setError(signInError.message ?? "Could not sign in.");
    // With two-factor on, the client plugin moves on to /two-factor.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
    finish();
  }

  async function sendMagicLink() {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Enter your email first, then ask for a sign-in link.");
    setBusy("magic");
    const { error: linkError } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard"
    });
    setBusy(null);
    if (linkError) return setError(linkError.message ?? "Could not send the sign-in link.");
    setNotice(`If ${email} has an account, a sign-in link is on its way. It expires in 5 minutes.`);
  }

  async function signInWithPasskey() {
    setError(null);
    setNotice(null);
    setBusy("passkey");
    const result = await authClient.signIn.passkey();
    setBusy(null);
    if (result?.error) return setError(result.error.message ?? "Passkey sign-in did not finish.");
    finish();
  }

  return (
    <AuthCard title="Welcome back" description="Sign in to continue to Nextomic.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FormInput
          name="email"
          type="email"
          label="Email"
          isRequired
          autoComplete="username webauthn"
          validationBehavior="aria"
          value={email}
          onValueChange={edit(setEmail)}
          isInvalid={Boolean(error)}
        />
        <PasswordInput
          name="password"
          label="Password"
          isRequired
          autoComplete="current-password"
          validationBehavior="aria"
          value={password}
          onValueChange={edit(setPassword)}
          isInvalid={Boolean(error)}
        />
        <div className="flex items-center justify-between">
          <Checkbox size="sm" isSelected={rememberMe} onValueChange={setRememberMe}>
            <span className="text-small text-default-600">Remember me</span>
          </Checkbox>
          <AuthLink href="/forgot-password">Forgot password?</AuthLink>
        </div>
        <AuthError message={error} />
        <AuthNotice message={notice} />
        <ActionButton
          type="submit"
          fullWidth
          isLoading={busy === "password"}
          isDisabled={busy !== null && busy !== "password"}
        >
          Sign in
        </ActionButton>
        <div className="flex items-center gap-3 text-tiny text-default-400">
          <Divider className="flex-1" />
          or
          <Divider className="flex-1" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionButton
            tone="outline"
            isLoading={busy === "magic"}
            isDisabled={busy !== null && busy !== "magic"}
            onPress={() => void sendMagicLink()}
          >
            <Icon name="ph:envelope-simple" width={16} height={16} />
            Email me a link
          </ActionButton>
          <ActionButton
            tone="outline"
            isLoading={busy === "passkey"}
            isDisabled={busy !== null && busy !== "passkey"}
            onPress={() => void signInWithPasskey()}
          >
            <Icon name="ph:fingerprint" width={16} height={16} />
            Use a passkey
          </ActionButton>
        </div>
        <p className="text-small text-default-500">
          New to Nextomic? <AuthLink href="/sign-up">Create an account</AuthLink>
        </p>
      </form>
    </AuthCard>
  );
}
