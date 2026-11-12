import { Skeleton } from "@heroui/react";

export default function ProjectsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <Skeleton className="h-10 w-full max-w-2xl rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
