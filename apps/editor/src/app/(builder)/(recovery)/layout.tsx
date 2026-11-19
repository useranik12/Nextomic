import type { ReactNode } from "react";

/** The page a reset link lands on. The visitor is already signed in by the link, so unlike the
 *  other auth pages it must not send signed-in people to the dashboard. */
export default function RecoveryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
