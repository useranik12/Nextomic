"use client";

import { Switch } from "@heroui/react";
import { VERSION_LIMIT_MAX, VERSION_LIMIT_MIN, type ProjectSettings } from "@nextomic/schema";
import { useState } from "react";
import { saveProjectSettingsAction } from "@/app/(builder)/editor/[id]/actions";
import { FormInput } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { useEditorStore } from "./store/editor-store";

// App-wide settings (docs/platform.md App Settings). Only settings that exist today are listed.
export function AppSettings() {
  const generateIds = useEditorStore((s) => s.project.generateElementIds);
  const versionControl = useEditorStore((s) => s.project.versionControl);
  const versionLimit = useEditorStore((s) => s.project.versionLimit);
  const [limitText, setLimitText] = useState(String(versionLimit));
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
      setLimitText(String(previous.versionLimit));
      setError(result.error);
      return;
    }
    setError(null);
  }

  function commitLimit(raw: string) {
    const n = Math.round(Number(raw));
    const next = Number.isFinite(n)
      ? Math.min(VERSION_LIMIT_MAX, Math.max(VERSION_LIMIT_MIN, n))
      : versionLimit;
    setLimitText(String(next));
    if (next !== versionLimit) void change({ versionLimit: next });
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
              text="Keeps a snapshot of a page every time it is saved, so you can restore an earlier version. Off: no new snapshots are made and the history limit in Page Settings is disabled."
            />
          </div>
          <FormInput
            compact
            aria-label="Default history limit"
            label="Default history limit"
            type="number"
            min={VERSION_LIMIT_MIN}
            max={VERSION_LIMIT_MAX}
            isDisabled={!versionControl || saving}
            value={limitText}
            onValueChange={setLimitText}
            onBlur={() => commitLimit(limitText)}
            description={`Versions kept per page, ${VERSION_LIMIT_MIN} to ${VERSION_LIMIT_MAX}. A page can set its own in Page Settings. The oldest versions are deleted first.`}
          />
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
