import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireWorkspaceMembership } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

/** True when the visitor has a session the dashboard accepts (same checks as its layout). */
async function canUseDashboard(): Promise<boolean> {
  const sessionData = await getServerSession();
  if (!sessionData) return false;
  try {
    await requireWorkspaceMembership(sessionData.user.id);
    return true;
  } catch {
    // The dashboard would send this account back here; show the auth pages instead of looping.
    return false;
  }
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Signed-in users never see sign in, sign up, reset or two-factor pages.
  if (await canUseDashboard()) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
