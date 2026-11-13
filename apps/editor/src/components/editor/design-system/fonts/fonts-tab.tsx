"use client";

import { fontsCss, type ProjectFont } from "@nextomic/schema";
import { useMemo, useState } from "react";
import { useEditorStore } from "../../store/editor-store";
import { IconsTab } from "../icons/icons-tab";
import { FontEditor } from "./font-editor";
import { FontManager } from "./font-manager";
import { useFontUsage } from "./use-font-usage";

type Sub = "fonts" | "icons";

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
        "rounded-full px-3 py-1 text-sm transition-colors duration-300 " +
        (active ? "bg-default-hover text-foreground" : "text-body hover:bg-default")
      }
    >
      {children}
    </button>
  );
}

const NO_USE = { variables: [], classes: 0, elements: 0, total: 0 };

/**
 * Design System > Fonts & Icons. Edits are drafts like every Design System change: they reach the
 * canvas at once and are written only when the modal's Save is pressed (docs/fonts-and-icons.md).
 */
export function FontsTab({ saveNow }: { saveNow: () => Promise<void> }) {
  const fonts = useEditorStore((s) => s.project.fonts);
  const projectId = useEditorStore((s) => s.projectId);
  const { uses, reload } = useFontUsage(fonts);
  const [sub, setSub] = useState<Sub>("fonts");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = fonts.find((f) => f.id === openId) ?? null;

  // The builder previews every installed font, active or not, from the same URLs sites use.
  const previewCss = useMemo(
    () =>
      fontsCss(
        fonts.map((f) => ({ ...f, active: true, rights: true })),
        `/fonts/${projectId}`
      ),
    [fonts, projectId]
  );

  const store = useEditorStore.getState;
  const replace = (next: ProjectFont) =>
    store().setFonts(store().project.fonts.map((f) => (f.id === next.id ? next : f)));

  async function added(font: ProjectFont) {
    const rest = store().project.fonts.filter((f) => f.id !== font.id);
    store().setFonts([...rest, font]);
    setOpenId(font.id);
    await saveNow();
  }

  async function remove(font: ProjectFont) {
    store().setFonts(store().project.fonts.filter((f) => f.id !== font.id));
    setOpenId(null);
    await reload();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <style>{previewCss}</style>
      <div
        className="flex items-center gap-1 border-b border-border p-3"
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
        <div className="min-h-0 flex-1">
          <IconsTab saveNow={saveNow} />
        </div>
      ) : open ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FontEditor
            key={open.id}
            font={open}
            fonts={fonts}
            use={uses[open.family] ?? NO_USE}
            onChange={replace}
            onBack={() => setOpenId(null)}
            onRemove={() => remove(open)}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <FontManager
            fonts={fonts}
            onOpen={(f) => setOpenId(f.id)}
            onAdded={added}
            onToggleFavorite={(f) => replace({ ...f, favorite: !f.favorite })}
          />
        </div>
      )}
    </div>
  );
}
