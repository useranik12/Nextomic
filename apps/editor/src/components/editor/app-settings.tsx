"use client";

import { SwitchField as Switch } from "@/components/ui/toggles";
import type { ProjectSettings } from "@nextomic/schema";
import { useState } from "react";
import { saveProjectSettingsAction, setHomePageAction } from "@/app/(builder)/editor/[id]/actions";
import { SelectField } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import type { PageSummary } from "@/server/pages";
import { AppAuthSettingsGroup } from "./app-auth-settings";
import { useEditorStore } from "./store/editor-store";

// App-wide settings (docs/platform.md App Settings). Only settings that exist today are listed.
export function AppSettings({
  pages,
  onPagesChange
}: {
  pages: PageSummary[];
  onPagesChange: (pages: PageSummary[]) => void;
}) {
  const generateIds = useEditorStore((s) => s.project.generateElementIds);
  const versionControl = useEditorStore((s) => s.project.versionControl);
  const hideEditBorder = useEditorStore((s) => s.project.hideEditBorder);
  const showClock = useEditorStore((s) => s.project.showClock);
  const generateScreenshots = useEditorStore((s) => s.project.generateScreenshots);
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

  /** The home page is a page setting; it is saved on the server and mirrored in the open page. */
  async function changeHome(pageId: string) {
    setSaving(true);
    const result = await setHomePageAction(useEditorStore.getState().projectId, pageId);
    setSaving(false);
    if (result.error !== null) return setError(result.error);
    setError(null);
    onPagesChange(pages.map((p) => ({ ...p, isHome: p.id === pageId })));
    const store = useEditorStore.getState();
    if (store.page) store.syncIsHome(store.page.id === pageId);
  }

  const home = pages.find((p) => p.isHome)?.id ?? "";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <h2 className="px-3 py-2 text-sm font-medium text-foreground">App Settings</h2>
      <div className="flex flex-col gap-5 px-3 pb-3">
        <SelectField
          label="Home page"
          value={home || "none"}
          isDisabled={saving || pages.length === 0}
          description="The page served at the site's address."
          options={[
            ...(home ? [] : [{ value: "none", label: "Choose a page" }]),
            ...pages.map((p) => ({ value: p.id, label: `${p.name} (${p.route})` }))
          ]}
          onValueChange={(v) => {
            if (v !== "none" && v !== home) void changeHome(v);
          }}
        />
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={generateIds}
            isDisabled={saving}
            onValueChange={(on) => void change({ generateElementIds: on })}
          >
            <span className="text-sm text-foreground">Generate element ID automatically</span>
          </Switch>
          <p className="text-xs text-muted">
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
              <span className="text-sm text-foreground">Version control</span>
            </Switch>
            <InfoTip
              label="Version control"
              text="Keeps a snapshot of a page every time it is saved, so you can restore an earlier version. Off: no snapshots are made for any page. Each page can also turn its history off and set how many versions it keeps in Page Settings."
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={generateScreenshots}
            isDisabled={saving}
            onValueChange={(on) => void change({ generateScreenshots: on })}
          >
            <span className="text-sm text-foreground">Generate Screenshots</span>
          </Switch>
          <p className="text-xs text-muted">
            Makes a small picture of every page and template for Pages &amp; Templates. A new
            picture replaces the old one, so only one is kept per item. Screenshots are private to
            people who can open this project.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={hideEditBorder}
            isDisabled={saving}
            onValueChange={(on) => void change({ hideEditBorder: on })}
          >
            <span className="text-sm text-foreground">Hide edit border while editing</span>
          </Switch>
          <p className="text-xs text-muted">
            Hides the blue outline of the selected element while you edit its Border settings, so
            you see the real border.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Switch
            isSelected={showClock}
            isDisabled={saving}
            onValueChange={(on) => void change({ showClock: on })}
          >
            <span className="text-sm text-foreground">Show time in the editor</span>
          </Switch>
          <p className="text-xs text-muted">
            Shows a running clock (hh:mm:ss, AM or PM) in the top bar, left of the open page link.
          </p>
        </div>
        <AppAuthSettingsGroup pages={pages} saving={saving} change={change} />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
