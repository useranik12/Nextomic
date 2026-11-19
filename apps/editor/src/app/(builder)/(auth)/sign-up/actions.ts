"use server";

import { redirect } from "next/navigation";
import { signUp } from "@/server/auth/actions";

export interface SignUpState {
  error: string | null;
  success: boolean;
}

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const result = await signUp({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? "")
  });
  if (result.error) return { error: result.error, success: false };
  // Without email confirmation, sign-up already signed the person in.
  if (!result.confirmEmail) redirect("/dashboard");
  return { error: null, success: true };
}
