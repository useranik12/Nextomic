import { Button } from "@heroui/react";
import Link from "next/link";

// The dashboard body (KPIs, charts, activity feed) is designed in-house and built last, after
// owner approval of a proposal (docs/ui-reference.md 4.1, docs/spec.md decisions log). Phase 0
// ships only the shell + this empty state.
export default function DashboardPage() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h2 className="text-2xl font-semibold text-foreground">Nothing here yet</h2>
      <p className="max-w-md text-default-500">
        Your dashboard overview (usage, activity, and health) arrives in a later phase. For now,
        head to All Projects to create or open a site.
      </p>
      <Button as={Link} href="/projects" color="primary">
        Go to All Projects
      </Button>
    </div>
  );
}
