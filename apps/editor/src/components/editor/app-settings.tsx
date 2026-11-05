"use client";

import { Switch } from "@heroui/react";
import { useState } from "react";
import { saveProjectSettingsAction } from "@/app/(builder)/editor/[id]/actions";
import { useEditorStore } from "./store/editor-store";

// App-wide settings (docs/platform.md App Settings). Only settings that exist today are listed.
export function AppSettings() {
  const generateIds = useEditorStore((s) => s.project.generateElementIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function toggle(on: boolean) {
    const store = useEditorStore.getState();
    const previous = store.project.generateElementIds;
    store.setGenerateElementIds(on);
    setSaving(true);
    const result = await saveProjectSettingsAction(
      store.projectId,
      useEditorStore.getState().project
    );
    setSaving(false);
    if (result.error !== null) {
      useEditorStore.getState().setGenerateElementIds(previous);
      setError(result.error);
      return;
    }
    setError(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="px-3 py-2 text-small font-medium text-foreground">App Settings</h2>
      <div className="flex flex-col gap-4 px-3 pb-3">
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={generateIds}
            isDisabled={saving}
            onValueChange={(on) => void toggle(on)}
          >
            <span className="text-small text-foreground">Generate element ID automatically</span>
          </Switch>
          <p className="text-tiny text-default-500">
            Gives every element a unique <code>nxtomc-</code> ID. Applies to the whole app, not to a
            single element.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-small text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
