import { Skeleton } from "@heroui/react";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-3 py-16">
      <Skeleton className="h-8 w-64 rounded-medium" />
      <Skeleton className="h-4 w-96 rounded-medium" />
      <Skeleton className="h-10 w-40 rounded-medium" />
    </div>
  );
}
