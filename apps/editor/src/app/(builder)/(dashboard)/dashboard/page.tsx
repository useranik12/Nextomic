import { ActionButton } from "@/components/ui/controls";

// The dashboard body (KPIs, charts, activity feed) is designed in-house and built last, after
// owner approval of a proposal (docs/ui-reference.md 4.1, docs/spec.md decisions log). Phase 0
// ships only the shell + this empty state.
export default function DashboardPage() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Nothing here yet</h2>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        Your dashboard overview (usage, activity, and health) arrives in a later phase. For now,
        head to All Projects to create or open a site.
      </p>
      <ActionButton href="/projects" className="mt-2">
        Go to All Projects
      </ActionButton>
    </div>
  );
}
