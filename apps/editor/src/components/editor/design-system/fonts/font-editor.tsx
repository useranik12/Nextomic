"use client";

import {
  FONT_FAMILY_PATTERN,
  FONT_SOFT_LIMIT_BYTES,
  FONT_SOFT_LIMIT_FILES,
  fontWeight,
  type ProjectFont
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { Icon } from "@/lib/icons/Icon";
import { FontFaces } from "./font-faces";
import { FontRoles } from "./font-roles";
import type { FontUse } from "./use-font-usage";

const kb = (bytes: number): string => `${Math.max(1, Math.round(bytes / 1000))} KB`;

function IconButton({
  label,
  icon,
  onPress,
  pressed,
  danger
}: {
  label: string;
  icon: "ph:arrow-left" | "ph:heart" | "ph:heart-fill" | "ph:trash";
  onPress: () => void;
  pressed?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onPress}
      className={
        "flex h-9 w-9 items-center justify-center rounded-medium border border-divider transition-colors duration-300 " +
        (danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-default-100") +
        (pressed ? " text-danger" : "")
      }
    >
      <Icon name={icon} width={16} height={16} />
    </button>
  );
}

/**
 * One font, like the Bricks font editor: a name, favorite and delete up top, then its faces
 * (variations), how it loads, and the font variable roles. A font is a group of faces that share a
 * name.
 */
export function FontEditor({
  font,
  fonts,
  use,
  onChange,
  onBack,
  onRemove
}: {
  font: ProjectFont;
  fonts: ProjectFont[];
  use: FontUse;
  onChange: (next: ProjectFont) => void;
  onBack: () => void;
  onRemove: () => Promise<void>;
}) {
  const [name, setName] = useState(font.family);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const weight = fontWeight(fonts);
  const over = weight.files > FONT_SOFT_LIMIT_FILES || weight.bytes > FONT_SOFT_LIMIT_BYTES;
  const inUse = use.total > 0;

  function commitName() {
    const next = name.trim();
    if (next === font.family) return setError(null);
    if (!FONT_FAMILY_PATTERN.test(next) || next.length > 64) {
      setName(font.family);
      return setError("Use letters, digits, spaces and - _ . + only.");
    }
    if (fonts.some((f) => f.id !== font.id && f.family.toLowerCase() === next.toLowerCase())) {
      setName(font.family);
      return setError("Another font has that name.");
    }
    setError(null);
    onChange({ ...font, family: next });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <IconButton label="Back to all fonts" icon="ph:arrow-left" onPress={onBack} />
        <input
          aria-label="Font name"
          value={name}
          disabled={inUse}
          title={inUse ? "This font is in use, so it cannot be renamed." : undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-9 min-w-0 flex-1 rounded-medium border border-default-200 bg-transparent px-3 text-small outline-none focus:border-default-800 disabled:opacity-70"
        />
        <IconButton
          label={font.favorite ? "Remove from favorites" : "Add to favorites"}
          icon={font.favorite ? "ph:heart-fill" : "ph:heart"}
          pressed={font.favorite}
          onPress={() => onChange({ ...font, favorite: !font.favorite })}
        />
        <IconButton
          label="Delete the font"
          icon="ph:trash"
          danger
          onPress={() => setConfirming(true)}
        />
      </header>
      <p className="text-tiny text-default-500">
        {font.source === "google" ? "Google Fonts" : "Custom font"} ·{" "}
        {font.license || "License not set"}
        {font.sourceNote ? ` · ${font.sourceNote}` : ""}
      </p>
      {error ? (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <div
          role="alertdialog"
          className="flex flex-wrap items-center gap-2 rounded-large bg-danger/10 p-3 text-small"
        >
          {inUse ? (
            <span className="min-w-0 flex-1">
              In use (
              {use.variables.length > 0
                ? `variables ${use.variables.map((n) => `--nxt-${n}`).join(", ")}`
                : ""}
              {use.classes > 0 ? ` ${use.classes} class${use.classes === 1 ? "" : "es"}` : ""}
              {use.elements > 0 ? ` ${use.elements} element${use.elements === 1 ? "" : "s"}` : ""}).
              Point them at another font first.
            </span>
          ) : (
            <span className="min-w-0 flex-1">Delete {font.family} and all its variations?</span>
          )}
          <ActionButton size="sm" tone="ghost" onPress={() => setConfirming(false)}>
            Keep
          </ActionButton>
          {!inUse ? (
            <ActionButton size="sm" tone="danger" onPress={() => void onRemove()}>
              Delete
            </ActionButton>
          ) : null}
        </div>
      ) : null}

      <FontFaces font={font} onChange={onChange} />

      <FontRoles font={font} use={use} />

      <section aria-label="Loading" className="flex flex-col gap-2 border-t border-divider pt-3">
        <SwitchRow
          label="Use this font on the site"
          tip="On: the font files are included in your site so text can use this font. Off: the font stays in your list but is not added to the site, so text falls back to another font."
          selected={font.active}
          onChange={(active) => onChange({ ...font, active })}
        />
        <SwitchRow
          label="Preload the main file"
          tip="Asks the browser to start downloading the main font file before the page needs it, so text appears in the right font sooner. Use it for the font of your headings or body, not for every font."
          selected={font.preload}
          disabled={!font.active}
          onChange={(preload) => onChange({ ...font, preload })}
        />
        {over ? (
          <p role="status" className="text-tiny text-warning">
            Fonts in use total {weight.files} files, {kb(weight.bytes)}. More than{" "}
            {FONT_SOFT_LIMIT_FILES} files or {kb(FONT_SOFT_LIMIT_BYTES)} slows the first view. Turn
            off fonts you do not use.
          </p>
        ) : (
          <p className="text-tiny text-default-500">
            Fonts in use: {weight.files} files, {kb(weight.bytes)}.
          </p>
        )}
      </section>
    </div>
  );
}
