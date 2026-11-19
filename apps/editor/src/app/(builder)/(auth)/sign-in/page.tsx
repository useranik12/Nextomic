"use client";

import { Separator } from "@heroui/react";
import { CheckboxField as Checkbox } from "@/components/ui/toggles";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, AuthError, AuthLink, AuthNotice } from "@/components/auth/auth-ui";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { getPasskey } from "@/lib/passkey-browser";
import {
  passkeyAuthenticationOptions,
  passkeyAuthenticationVerify,
  sendMagicLink as sendMagicLinkAction,
  signInPassword
} from "@/server/auth/actions";
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
    const result = await signInPassword({ email, password, rememberMe });
    setBusy(null);
    if (result.error) return setError(result.error);
    if (result.needsSecondStep) {
      router.push("/two-factor");
      return;
    }
    finish();
  }

  async function sendMagicLink() {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Enter your email first, then ask for a sign-in link.");
    setBusy("magic");
    const linkResult = await sendMagicLinkAction(email);
    setBusy(null);
    if (linkResult.error) return setError(linkResult.error);
    setNotice(`If ${email} has an account, a sign-in link is on its way.`);
  }

  async function signInWithPasskey() {
    setError(null);
    setNotice(null);
    setBusy("passkey");
    try {
      const start = await passkeyAuthenticationOptions();
      if (start.error !== null) throw new Error(start.error);
      const credential = await getPasskey(start.options);
      const result = await passkeyAuthenticationVerify({
        challengeId: start.challengeId,
        credential,
        rememberMe
      });
      if (result.error) throw new Error(result.error);
      finish();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Passkey sign-in did not finish.");
    } finally {
      setBusy(null);
    }
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
            <span className="text-sm text-body">Remember me</span>
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
        <div className="flex items-center gap-3 text-xs text-subtle">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
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
        <p className="text-sm text-muted">
          New to Nextomic? <AuthLink href="/sign-up">Create an account</AuthLink>
        </p>
      </form>
    </AuthCard>
  );
}
