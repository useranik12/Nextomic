"use client";
import { Busy } from "@/components/ui/busy";

import type { ReactNode } from "react";
import { ActionButton } from "@/components/ui/controls";
import { AuthCard } from "./auth-card";
import { ConnectionCard } from "./connection-card";
import { StorageCard } from "./storage-card";
import { TablesCard } from "./tables-card";
import { useSupabasePage } from "./use-supabase-page";

/** A titled card of the Supabase page (`pages/editor-supabase.png`). */
export function SupabaseCard({
  title,
  description,
  aside,
  badge,
  className,
  children
}: {
  title: string;
  /** Extra classes for the card, e.g. a height limit. */
  className?: string;
  /** Shown beside the title, e.g. the connection status. */
  badge?: ReactNode;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col gap-4 rounded-2xl border border-border p-6 ${className ?? ""}`}
      aria-label={title}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium text-foreground">{title}</h2>
            {badge}
          </div>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The Supabase page: connection, authentication settings, tables and views, storage. */
export function SupabasePage({ projectId }: { projectId: string }) {
  const model = useSupabasePage(projectId);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Supabase Connection</h1>
          <p className="text-sm text-muted">
            Connect a Supabase project for data and bindings in the app. Only the anon key is used.
          </p>
        </header>
        {model.loadError ? (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-2xl border border-danger/40 p-4 text-sm text-danger"
          >
            {model.loadError}
            <ActionButton size="sm" tone="ghost" onPress={() => void model.reload()}>
              Try again
            </ActionButton>
          </div>
        ) : !model.data ? (
          <Busy label="Loading the Supabase connection" className="self-start" />
        ) : (
          <>
            <ConnectionCard model={model} />
            <AuthCard model={model} />
            <TablesCard model={model} />
            <StorageCard projectId={projectId} model={model} />
          </>
        )}
      </div>
    </div>
  );
}
