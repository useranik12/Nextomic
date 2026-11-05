"use server";

import { APIError } from "better-auth/api";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSmtpConfigured } from "@/lib/mail";

export interface SignUpState {
  error: string | null;
  success: boolean;
}

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const allowSignup = process.env.ALLOW_SIGNUP !== "false";
  if (!allowSignup) {
    return {
      error: "Sign-up is currently disabled. Ask your admin for an invite.",
      success: false
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are all required.", success: false };
  }

  try {
    await auth.api.signUpEmail({ body: { name, email, password } });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false };
    }
    return { error: "Something went wrong creating your account.", success: false };
  }

  // Without SMTP, verification is not required and sign-up already signed the user in.
  if (!isSmtpConfigured()) redirect("/dashboard");

  return { error: null, success: true };
}
