"use client";
import { Busy } from "@/components/ui/busy";

import type { RestCall, RestGroup } from "@nextomic/schema";
import { ActionButton } from "@/components/ui/controls";
import { ApiList } from "./api-list";
import { CallEditor } from "./call-editor";
import { GroupEditor } from "./group-editor";
import { useApiData } from "./use-api-data";

/** The API Data page (`pages/editor-api-data-*.png`): API Calls on the left, the editor on the right. */
export function ApiDataPage({ projectId }: { projectId: string }) {
  const model = useApiData(projectId);
  const { data, loadError, selection, newItem } = model;

  if (loadError && !data)
    return (
      <div className="flex h-full flex-col items-start gap-3 p-6">
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
        <ActionButton size="sm" tone="ghost" onPress={() => void model.reload()}>
          Try again
        </ActionButton>
      </div>
    );
  if (!data)
    return (
      <div className="flex h-full items-center justify-center">
        <Busy label="Loading API Data" />
      </div>
    );

  const { config } = data;
  const savedCall =
    selection?.kind === "call" ? config.calls.find((c) => c.id === selection.id) : undefined;
  const savedGroup =
    selection?.kind === "group" ? config.groups.find((g) => g.id === selection.id) : undefined;
  const call = savedCall ?? (selection?.kind === "call" && newItem ? (newItem as RestCall) : null);
  const group =
    savedGroup ?? (selection?.kind === "group" && newItem ? (newItem as RestGroup) : null);

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-border p-4">
        <ApiList model={model} config={config} />
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">
          {call ? (
            <CallEditor
              key={call.id}
              model={model}
              saved={call}
              config={config}
              isNew={!savedCall}
            />
          ) : group ? (
            <GroupEditor
              key={group.id}
              model={model}
              saved={group}
              config={config}
              isNew={!savedGroup}
            />
          ) : (
            <div className="flex flex-col gap-1 pt-10 text-center">
              <h1 className="text-xl font-semibold text-foreground">API Data</h1>
              <p className="text-sm text-muted">
                Choose an API call or group on the left, or press + to add one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
