import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireWorkspaceMembership } from "@/lib/permissions";
import { getServerSession } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const sessionData = await getServerSession();
  if (!sessionData) {
    redirect("/sign-in");
  }

  try {
    await requireWorkspaceMembership(sessionData.user.id);
  } catch {
    // Every verified user gets a workspace at signup (see lib/auth.ts). Reaching this means the
    // account predates that hook or data is inconsistent — fail safe rather than show a workspace.
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        userName={sessionData.user.name}
        userEmail={sessionData.user.email}
        userImage={sessionData.user.image}
      />
      <div className="mx-auto flex max-w-[1400px] gap-10 px-8 py-6">
        <DashboardNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
