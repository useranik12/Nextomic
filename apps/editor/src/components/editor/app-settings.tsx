"use client";

import { Switch } from "@heroui/react";
import type { ProjectSettings } from "@nextomic/schema";
import { useState } from "react";
import { saveProjectSettingsAction } from "@/app/(builder)/editor/[id]/actions";
import { InfoTip } from "@/components/ui/info-tip";
import { useEditorStore } from "./store/editor-store";

// App-wide settings (docs/platform.md App Settings). Only settings that exist today are listed.
export function AppSettings() {
  const generateIds = useEditorStore((s) => s.project.generateElementIds);
  const versionControl = useEditorStore((s) => s.project.versionControl);
  const hideEditBorder = useEditorStore((s) => s.project.hideEditBorder);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Applies a settings change at once and saves it; a failed save puts the old values back. */
  async function change(patch: Partial<ProjectSettings>) {
    const store = useEditorStore.getState();
    const previous = store.project;
    if ("generateElementIds" in patch)
      store.setGenerateElementIds(Boolean(patch.generateElementIds));
    else store.patchProject(patch);
    setSaving(true);
    const result = await saveProjectSettingsAction(
      store.projectId,
      useEditorStore.getState().project
    );
    setSaving(false);
    if (result.error !== null) {
      useEditorStore.getState().patchProject(previous);
      setError(result.error);
      return;
    }
    setError(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="px-3 py-2 text-small font-medium text-foreground">App Settings</h2>
      <div className="flex flex-col gap-5 px-3 pb-3">
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={generateIds}
            isDisabled={saving}
            onValueChange={(on) => void change({ generateElementIds: on })}
          >
            <span className="text-small text-foreground">Generate element ID automatically</span>
          </Switch>
          <p className="text-tiny text-default-500">
            Gives every element a unique <code>nxtomc-</code> ID. Turning it on also adds an ID to
            every element that has none. Applies to the whole app, not to a single element.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Switch
              isSelected={versionControl}
              isDisabled={saving}
              onValueChange={(on) => void change({ versionControl: on })}
            >
              <span className="text-small text-foreground">Version control</span>
            </Switch>
            <InfoTip
              label="Version control"
              text="Keeps a snapshot of a page every time it is saved, so you can restore an earlier version. Off: no snapshots are made for any page. Each page can also turn its history off and set how many versions it keeps in Page Settings."
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={hideEditBorder}
            isDisabled={saving}
            onValueChange={(on) => void change({ hideEditBorder: on })}
          >
            <span className="text-small text-foreground">Hide edit border while editing</span>
          </Switch>
          <p className="text-tiny text-default-500">
            Hides the blue outline of the selected element while you edit its Border settings, so
            you see the real border.
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
