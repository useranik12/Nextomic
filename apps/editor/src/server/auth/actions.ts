"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { passwordPolicy } from "@/lib/auth";
import { MAX_PASSWORD_LENGTH, passwordProblem } from "@/lib/password-policy";
import { getPartialSession, getServerSession } from "@/lib/session";
import { appUrl, SESSION_ONLY_COOKIE, secureCookies, supabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createRateLimiter } from "@/server/rate-limit";

// Every builder sign-in step runs here, on the server: the browser never holds a Supabase client or
// a token, because published and preview sites share this origin and run their own scripts.

export interface AuthResult {
  error: string | null;
}
const OK: AuthResult = { error: null };
const fail = (error: string): AuthResult => ({ error });

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const ATTEMPTS = createRateLimiter(10, 10 * 60_000);

function limited(key: string): AuthResult | null {
  return ATTEMPTS.take(key).ok ? null : fail("Too many attempts. Try again in a few minutes.");
}

async function setSessionOnly(sessionOnly: boolean) {
  const store = await cookies();
  if (sessionOnly)
    store.set(SESSION_ONLY_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies(),
      path: "/"
    });
  else store.delete(SESSION_ONLY_COOKIE);
}

/** A client that signs in for one check and keeps nothing (verifies a password without touching the session). */
function probeClient() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Password sign-in. `needsSecondStep` is true when the account has an authenticator app. */
export async function signInPassword(input: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<AuthResult & { needsSecondStep?: boolean }> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success || !input.password) return fail("Enter your email and password.");
  const blocked = limited(`signin:${email.data}`);
  if (blocked) return blocked;
  await setSessionOnly(!input.rememberMe);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: input.password
  });
  if (error)
    return fail(
      error.code === "email_not_confirmed"
        ? "Confirm your email first. Check your inbox."
        : "Wrong email or password."
    );
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    error: null,
    needsSecondStep: data?.nextLevel === "aal2" && data.currentLevel !== "aal2"
  };
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult & { confirmEmail?: boolean }> {
  if (process.env.ALLOW_SIGNUP === "false")
    return fail("Sign-up is currently disabled. Ask your admin for an invite.");
  const email = emailSchema.safeParse(input.email);
  const name = input.name.trim();
  if (!name || !email.success) return fail("Name and a valid email are required.");
  if (input.password.length > MAX_PASSWORD_LENGTH) return fail("That password is too long.");
  const problem = passwordProblem(input.password, passwordPolicy);
  if (problem) return fail(problem);
  const blocked = limited(`signup:${email.data}`);
  if (blocked) return blocked;
  const [firstName, ...rest] = name.split(/\s+/);
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: input.password,
    options: {
      data: { first_name: firstName, last_name: rest.join(" ") },
      emailRedirectTo: `${appUrl()}/auth/callback`
    }
  });
  if (error) return fail(error.message);
  return { error: null, confirmEmail: !data.session };
}

/** Sends a one-time sign-in link. The answer never says whether the address has an account. */
export async function sendMagicLink(rawEmail: string): Promise<AuthResult> {
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return fail("Enter your email first, then ask for a sign-in link.");
  const blocked = limited(`magic:${email.data}`);
  if (blocked) return blocked;
  const supabase = await createSupabaseServer();
  await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${appUrl()}/auth/callback` }
  });
  return OK;
}

export async function requestPasswordReset(rawEmail: string): Promise<AuthResult> {
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return fail("Enter a valid email address.");
  const blocked = limited(`reset:${email.data}`);
  if (blocked) return blocked;
  const supabase = await createSupabaseServer();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`
  });
  return OK;
}

/** Sets a new password for the person who just came back through a reset link. */
export async function setNewPassword(password: string): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) return fail("This reset link has expired. Request a new one.");
  if (password.length > MAX_PASSWORD_LENGTH) return fail("That password is too long.");
  const problem = passwordProblem(password, passwordPolicy);
  if (problem) return fail(problem);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.message);
  await supabase.auth.signOut();
  return OK;
}

/** Emails a 6-digit code to the signed-in account to confirm a password change. */
export async function sendPasswordCode(): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) return fail("Sign in again to continue.");
  const blocked = limited(`pwcode:${session.user.id}`);
  if (blocked) return blocked;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.reauthenticate();
  return error ? fail(error.message) : OK;
}

/** Saves a new password once the emailed code matches. */
export async function changePassword(input: {
  code: string;
  password: string;
}): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) return fail("Sign in again to continue.");
  const blocked = limited(`pwchange:${session.user.id}`);
  if (blocked) return blocked;
  if (!/^\d{6}$/.test(input.code.trim())) return fail("Enter the 6-digit code.");
  if (input.password.length > MAX_PASSWORD_LENGTH) return fail("That password is too long.");
  const problem = passwordProblem(input.password, passwordPolicy);
  if (problem) return fail(problem);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({
    password: input.password,
    nonce: input.code.trim()
  });
  return error ? fail("That code is wrong or has expired.") : OK;
}

export async function signOut(): Promise<never> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

/** Starts an email change: a confirmation link goes to the NEW address; the email changes when it is opened. */
export async function requestEmailChange(rawEmail: string): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) return fail("Sign in again to continue.");
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return fail("Enter a valid email address.");
  if (email.data === session.user.email.toLowerCase()) return fail("That is already your email.");
  const blocked = limited(`emailchange:${session.user.id}`);
  if (blocked) return blocked;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser(
    { email: email.data },
    { emailRedirectTo: `${appUrl()}/auth/callback?next=/settings` }
  );
  return error ? fail(error.message) : OK;
}

// ---- Two-step sign-in (authenticator app) -------------------------------------------------------

export interface TotpEnrollment {
  factorId: string;
  qrSvg: string;
  secret: string;
}

export async function startTotpEnrollment(): Promise<AuthResult & { enrollment?: TotpEnrollment }> {
  const session = await getServerSession();
  if (!session) return fail("Sign in again to continue.");
  const supabase = await createSupabaseServer();
  // A half-finished earlier attempt would block a new one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? [])
    if (factor.factor_type === "totp" && factor.status === "unverified")
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`
  });
  if (error || !data) return fail(error?.message ?? "Could not start two-factor setup.");
  return {
    error: null,
    enrollment: { factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret }
  };
}

/** Confirms an enrollment or answers the second sign-in step: both check a code from the app. */
export async function verifyTotp(input: { factorId?: string; code: string }): Promise<AuthResult> {
  const session = await getPartialSession();
  if (!session) return fail("Sign in again to continue.");
  const code = input.code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit code.");
  const blocked = limited(`totp:${session.id}`);
  if (blocked) return blocked;
  const supabase = await createSupabaseServer();
  let factorId = input.factorId;
  if (!factorId) {
    const { data } = await supabase.auth.mfa.listFactors();
    factorId = data?.totp[0]?.id;
  }
  if (!factorId) return fail("No authenticator app is set up for this account.");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return error ? fail("That code did not work.") : OK;
}

export async function disableTotp(password: string): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) return fail("Sign in again to continue.");
  const blocked = limited(`totpoff:${session.user.id}`);
  if (blocked) return blocked;
  const { error: wrong } = await probeClient().auth.signInWithPassword({
    email: session.user.email,
    password
  });
  if (wrong) return fail("Your password is not correct.");
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const factor of data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return fail(error.message);
  }
  return OK;
}

// ---- Passkeys: the browser runs navigator.credentials, the server talks to Auth -----------------

export async function passkeyRegistrationOptions() {
  const session = await getServerSession();
  if (!session) return { error: "Sign in again to continue." } as const;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.passkey.startRegistration();
  if (error || !data) return { error: error?.message ?? "Could not start passkey setup." } as const;
  return { error: null, challengeId: data.challenge_id, options: data.options } as const;
}

export async function passkeyRegistrationVerify(input: {
  challengeId: string;
  credential: unknown;
}): Promise<AuthResult> {
  const session = await getServerSession();
  if (!session) return fail("Sign in again to continue.");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.passkey.verifyRegistration({
    challengeId: input.challengeId,
    credential: input.credential as never
  });
  return error ? fail(error.message) : OK;
}

export async function passkeyAuthenticationOptions() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.passkey.startAuthentication();
  if (error || !data)
    return { error: error?.message ?? "Could not start passkey sign-in." } as const;
  return { error: null, challengeId: data.challenge_id, options: data.options } as const;
}

export async function passkeyAuthenticationVerify(input: {
  challengeId: string;
  credential: unknown;
  rememberMe: boolean;
}): Promise<AuthResult> {
  await setSessionOnly(!input.rememberMe);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.passkey.verifyAuthentication({
    challengeId: input.challengeId,
    credential: input.credential as never
  });
  return error ? fail("That passkey was not accepted.") : OK;
}

export async function listPasskeys() {
  const session = await getServerSession();
  if (!session) return [];
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.passkey.list();
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.friendly_name ?? "Passkey",
    createdAt: p.created_at
  }));
}

export async function renamePasskey(passkeyId: string, friendlyName: string): Promise<AuthResult> {
  const name = friendlyName.trim().slice(0, 120);
  if (!name) return fail("Enter a name.");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName: name });
  return error ? fail(error.message) : OK;
}

export async function deletePasskey(passkeyId: string): Promise<AuthResult> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  return error ? fail(error.message) : OK;
}
