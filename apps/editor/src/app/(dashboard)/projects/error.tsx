"use client";

import { ActionButton } from "@/components/ui/controls";
import { useEffect } from "react";
import { Icon } from "@/lib/icons/Icon";

export default function ProjectsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-large border border-divider py-20 text-center">
      <Icon name="ph:warning-circle" label="Error" className="text-4xl text-danger" />
      <p className="text-lg font-medium text-foreground">Could not load your projects</p>
      <p className="max-w-sm text-default-500">{error.message || "Something went wrong."}</p>
      <ActionButton onPress={reset}>Try again</ActionButton>
    </div>
  );
}
