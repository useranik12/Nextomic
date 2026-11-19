"use client";

import { IMAGE_QUALITY_STEPS, type ProjectSettings } from "@nextomic/schema";
import { useState } from "react";
import { saveProjectSettingsAction, setHomePageAction } from "@/app/(builder)/editor/[id]/actions";
import { SelectField } from "@/components/ui/controls";
import { TipField } from "@/components/ui/info-tip";
import { SettingsGroup } from "@/components/ui/settings-group";
import { StepPicker } from "@/components/ui/step-picker";
import { Toggle } from "@/components/ui/toggles";
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
  const compression = useEditorStore((s) => s.project.imageCompression);
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
      <div className="flex flex-col gap-4 px-3 pb-4">
        <SettingsGroup title="General" first>
          <TipField label="Home page" tip="The page served at the site's address.">
            <SelectField
              compact
              hideLabel
              label="Home page"
              value={home || "none"}
              isDisabled={saving || pages.length === 0}
              options={[
                ...(home ? [] : [{ value: "none", label: "Choose a page" }]),
                ...pages.map((p) => ({ value: p.id, label: `${p.name} (${p.route})` }))
              ]}
              onValueChange={(v) => {
                if (v !== "none" && v !== home) void changeHome(v);
              }}
            />
          </TipField>
          <Toggle
            label="Generate element ID automatically"
            tip="Gives every element a unique nxtomc- ID. Turning it on also adds an ID to every element that has none. Applies to the whole app, not to a single element."
            isSelected={generateIds}
            isDisabled={saving}
            onChange={(on) => void change({ generateElementIds: on })}
          />
        </SettingsGroup>
        <SettingsGroup title="Media">
          <Toggle
            label="Compress uploaded images"
            tip="Shrinks every image you upload to this project into a WebP file before it is sent. It happens in your browser, so the server does no extra work. Images longer than 1500 px on their longer side are scaled down to 1500 px (smaller ones are never enlarged). SVG, GIF, video and other files are uploaded as they are. Off: images are uploaded exactly as they are. HEIC photos are always converted, because browsers cannot show them."
            isSelected={compression.enabled}
            isDisabled={saving}
            onChange={(on) => void change({ imageCompression: { ...compression, enabled: on } })}
          />
          <StepPicker
            label="Image quality"
            tip="Higher is sharper and makes bigger files. 40% is the smallest file, 80% keeps the most detail. 60% suits most sites. If the compressed copy would be larger than the original, the original is kept."
            steps={IMAGE_QUALITY_STEPS}
            value={compression.quality}
            isDisabled={saving || !compression.enabled}
            onChange={(quality) => void change({ imageCompression: { ...compression, quality } })}
          />
        </SettingsGroup>
        <SettingsGroup title="Pages">
          <Toggle
            label="Version control"
            tip="Keeps a snapshot of a page every time it is saved, so you can restore an earlier version. Off: no snapshots are made for any page. Each page can also turn its history off and set how many versions it keeps in Page Settings."
            isSelected={versionControl}
            isDisabled={saving}
            onChange={(on) => void change({ versionControl: on })}
          />
          <Toggle
            label="Generate Screenshots"
            tip="Makes a small picture of every page and template for the grid view of pages and templates. A new picture replaces the old one, so only one is kept per item. Screenshots are private to people who can open this project."
            isSelected={generateScreenshots}
            isDisabled={saving}
            onChange={(on) => void change({ generateScreenshots: on })}
          />
        </SettingsGroup>
        <SettingsGroup title="Editor">
          <Toggle
            label="Hide edit border while editing"
            tip="Hides the blue outline of the selected element while you edit its Border settings, so you see the real border."
            isSelected={hideEditBorder}
            isDisabled={saving}
            onChange={(on) => void change({ hideEditBorder: on })}
          />
          <Toggle
            label="Show time in the editor"
            tip="Shows a running clock (hh:mm:ss, AM or PM) in the top bar, left of the open page link."
            isSelected={showClock}
            isDisabled={saving}
            onChange={(on) => void change({ showClock: on })}
          />
        </SettingsGroup>
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
