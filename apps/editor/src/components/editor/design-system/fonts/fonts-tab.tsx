"use client";

import { fontsCss, type ProjectFont } from "@nextomic/schema";
import { useMemo, useState } from "react";
import { useEditorStore } from "../../store/editor-store";
import { AddGoogleFont } from "./add-google-font";
import { AddUploadFont } from "./add-upload-font";
import { FontDetails } from "./font-details";
import { useFontUsage } from "./use-font-usage";

type Sub = "fonts" | "icons";
type AddMode = "google" | "upload";

function Pill({
  active,
  onPress,
  children
}: {
  active: boolean;
  onPress: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      className={
        "rounded-full px-3 py-1 text-small transition-colors duration-300 " +
        (active ? "bg-default-800 text-default-50" : "text-default-600 hover:bg-default-100")
      }
    >
      {children}
    </button>
  );
}

/** Design System > Fonts & Icons. Icons arrive with the Media phase (docs/fonts-and-icons.md). */
export function FontsTab({ saveNow }: { saveNow: () => Promise<void> }) {
  const fonts = useEditorStore((s) => s.project.fonts);
  const projectId = useEditorStore((s) => s.projectId);
  const { uses, reload } = useFontUsage(fonts);
  const [sub, setSub] = useState<Sub>("fonts");
  const [adding, setAdding] = useState<AddMode | null>(fonts.length === 0 ? "google" : null);
  const [selectedId, setSelectedId] = useState<string | null>(fonts[0]?.id ?? null);
  const selected = fonts.find((f) => f.id === selectedId) ?? null;

  // The builder previews every installed font, active or not, from the same URLs sites use.
  const previewCss = useMemo(
    () =>
      fontsCss(
        fonts.map((f) => ({ ...f, active: true })),
        `/fonts/${projectId}`
      ),
    [fonts, projectId]
  );

  async function added(font: ProjectFont) {
    useEditorStore.getState().setFonts([...useEditorStore.getState().project.fonts, font]);
    setSelectedId(font.id);
    setAdding(null);
    await saveNow();
  }

  function change(next: ProjectFont) {
    useEditorStore
      .getState()
      .setFonts(useEditorStore.getState().project.fonts.map((f) => (f.id === next.id ? next : f)));
  }

  async function remove(font: ProjectFont) {
    const rest = useEditorStore.getState().project.fonts.filter((f) => f.id !== font.id);
    useEditorStore.getState().setFonts(rest);
    setSelectedId(rest[0]?.id ?? null);
    await saveNow();
    await reload();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <style>{previewCss}</style>
      <div
        className="flex items-center gap-1 border-b border-divider p-3"
        role="group"
        aria-label="Fonts and icons"
      >
        <Pill active={sub === "fonts"} onPress={() => setSub("fonts")}>
          Fonts
        </Pill>
        <Pill active={sub === "icons"} onPress={() => setSub("icons")}>
          Icons
        </Pill>
      </div>
      {sub === "icons" ? (
        <p className="p-4 text-small text-default-500">
          Icon libraries arrive with the Media manager (a later phase). Fonts are ready now.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 shrink-0 flex-col border-r border-divider">
            <div role="group" aria-label="Add a font" className="grid grid-cols-2 gap-1 p-3">
              {(
                [
                  ["google", "Google Fonts"],
                  ["upload", "Upload"]
                ] as const
              ).map(([mode, text]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={adding === mode}
                  onClick={() => setAdding(mode)}
                  className={
                    "h-8 rounded-full px-3 text-tiny font-medium transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-default-800/40 " +
                    (adding === mode
                      ? "bg-default-800 text-default-50"
                      : "border border-default-200 text-default-700 hover:bg-default-100")
                  }
                >
                  {text}
                </button>
              ))}
            </div>
            <ul aria-label="Project fonts" className="min-h-0 flex-1 overflow-y-auto">
              {fonts.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-current={selectedId === f.id && adding === null}
                    onClick={() => {
                      setSelectedId(f.id);
                      setAdding(null);
                    }}
                    className={
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors duration-300 " +
                      (selectedId === f.id && adding === null
                        ? "bg-default-200"
                        : "hover:bg-default-100")
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-small font-medium">{f.family}</span>
                      <span className="block text-tiny text-default-500">
                        {f.files.length} file{f.files.length === 1 ? "" : "s"} ·{" "}
                        {f.active ? "loads on sites" : "off"}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      style={{ fontFamily: `"${f.family}", sans-serif` }}
                      className="text-large"
                    >
                      Aa
                    </span>
                  </button>
                </li>
              ))}
              {fonts.length === 0 ? (
                <li className="px-3 py-2 text-small text-default-500">
                  No fonts yet. Sites use system fonts until you add one.
                </li>
              ) : null}
            </ul>
          </aside>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {adding === "google" ? <AddGoogleFont installed={fonts} onInstalled={added} /> : null}
            {adding === "upload" ? <AddUploadFont onInstalled={added} /> : null}
            {adding === null && selected ? (
              <FontDetails
                key={selected.id}
                font={selected}
                fonts={fonts}
                use={uses[selected.family] ?? { variables: [], classes: 0, elements: 0, total: 0 }}
                onChange={change}
                onRemove={() => remove(selected)}
              />
            ) : null}
            {adding === null && !selected ? (
              <p className="p-4 text-small text-default-500">Add a font to get started.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
