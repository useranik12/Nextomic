"use client";

import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";

interface ErrorViewProps {
  title: string;
  message: string;
  /** Shown as "Try again" when the error can be retried in place. */
  onRetry?: () => void;
  className?: string;
}

/** Builder error and not-found body: what went wrong, a retry when possible, and a way back. */
export function ErrorView({ title, message, onRetry, className }: ErrorViewProps) {
  return (
    <div className={`flex flex-col items-center gap-3 py-20 text-center ${className ?? ""}`}>
      <Icon name="ph:warning-circle" label="Error" className="text-4xl text-danger" />
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      <div className="flex gap-2">
        {onRetry ? <ActionButton onPress={onRetry}>Try again</ActionButton> : null}
        <ActionButton href="/dashboard" tone={onRetry ? "outline" : "primary"}>
          Go to dashboard
        </ActionButton>
      </div>
    </div>
  );
}
