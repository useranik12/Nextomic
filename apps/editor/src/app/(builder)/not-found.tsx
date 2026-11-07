import { ErrorView } from "@/components/errors/error-view";

export default function BuilderNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <ErrorView
        title="Page not found"
        message="This page does not exist, or you do not have access to it."
      />
    </main>
  );
}
