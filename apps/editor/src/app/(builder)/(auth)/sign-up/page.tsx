import { SignUpForm } from "@/components/auth/sign-up-form";
import { passwordPolicy } from "@/lib/auth";

export default function SignUpPage() {
  return <SignUpForm policy={passwordPolicy} />;
}
