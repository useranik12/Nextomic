"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/errors/error-view";

export default function BuilderError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <ErrorView
        title="Something went wrong"
        message={error.message || "The page could not be shown."}
        onRetry={reset}
      />
    </main>
  );
}
