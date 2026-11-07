"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/errors/error-view";

export default function ProjectsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorView
      title="Could not load your projects"
      message={error.message || "Something went wrong."}
      onRetry={reset}
      className="rounded-large border border-divider"
    />
  );
}
