import { ResetPasswordView } from "@/components/auth/reset-password-form";
import { passwordPolicy } from "@/lib/auth";

export default function ResetPasswordPage() {
  return <ResetPasswordView policy={passwordPolicy} />;
}
