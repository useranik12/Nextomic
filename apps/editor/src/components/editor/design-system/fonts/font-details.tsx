"use client";

import { Switch } from "@heroui/react";
import {
  FONT_SOFT_LIMIT_BYTES,
  FONT_SOFT_LIMIT_FILES,
  fontStack,
  fontWeight,
  mentionsFamily,
  type ProjectFont
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { useEditorStore } from "../../store/editor-store";
import type { FontUse } from "./use-font-usage";

const ROLES = [
  { name: "font-heading", label: "Heading" },
  { name: "font-body", label: "Body" },
  { name: "font-mono", label: "Mono" }
] as const;

const SAMPLE = "The quick brown fox jumps over the lazy dog 0123456789";
const kb = (bytes: number): string => `${Math.max(1, Math.round(bytes / 1000))} KB`;

function weightLabel(f: ProjectFont["files"][number]): string {
  return f.weightMax ? `${f.weight}–${f.weightMax} variable` : String(f.weight);
}

function usageText(use: FontUse): string {
  return [
    use.variables.length > 0
      ? `variables ${use.variables.map((n) => `--nxt-${n}`).join(", ")}`
      : "",
    use.classes > 0 ? `${use.classes} class${use.classes === 1 ? "" : "es"}` : "",
    use.elements > 0 ? `${use.elements} element${use.elements === 1 ? "" : "s"}` : ""
  ]
    .filter(Boolean)
    .join(", ");
}

/** One font: preview, load settings, roles, files, and removal (blocked while the font is used). */
export function FontDetails({
  font,
  fonts,
  use,
  onChange,
  onRemove
}: {
  font: ProjectFont;
  fonts: ProjectFont[];
  use: FontUse;
  onChange: (next: ProjectFont) => void;
  onRemove: () => Promise<void>;
}) {
  const variables = useEditorStore((s) => s.project.variables);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const stack = fontStack(font);
  const weight = fontWeight(fonts);
  const over = weight.files > FONT_SOFT_LIMIT_FILES || weight.bytes > FONT_SOFT_LIMIT_BYTES;
  const weights = [...new Set(font.files.map((f) => f.weight))].sort((a, b) => a - b);
  const [previewWeight, setPreviewWeight] = useState(
    String(weights.includes(400) ? 400 : (weights[0] ?? 400))
  );
  const hasItalic = font.files.some((f) => f.style === "italic");
  const roleSet = (name: string): boolean => {
    const v = variables.find((x) => x.name === name);
    return v ? mentionsFamily(v.value, font.family) : false;
  };

  function setRole(name: string) {
    useEditorStore
      .getState()
      .upsertVariables([{ name, type: "font-family", group: "Typography", value: stack }]);
  }

  async function remove() {
    setBusy(true);
    await onRemove();
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-large font-semibold">{font.family}</h3>
          <p className="text-tiny text-default-500">
            {font.source === "google" ? "Google Fonts" : "Uploaded"} ·{" "}
            {font.license || "License not set"}
            {font.sourceNote ? ` · ${font.sourceNote}` : ""}
          </p>
        </div>
        <Switch
          size="sm"
          isSelected={font.active}
          onValueChange={(active) => onChange({ ...font, active })}
          aria-label={`Load ${font.family} on built sites`}
        >
          <span className="text-small">Load on sites</span>
        </Switch>
      </header>

      <section aria-label="Preview" className="rounded-large border border-divider p-4">
        <p style={{ fontFamily: stack, fontWeight: Number(previewWeight) }} className="text-2xl">
          {SAMPLE}
        </p>
        {hasItalic ? (
          <p
            style={{ fontFamily: stack, fontStyle: "italic", fontWeight: Number(previewWeight) }}
            className="mt-2 text-large"
          >
            {SAMPLE}
          </p>
        ) : null}
        <div className="mt-3 max-w-[180px]">
          <SelectField
            compact
            label="Preview weight"
            options={weights.map((w) => ({ value: String(w), label: String(w) }))}
            value={previewWeight}
            onValueChange={setPreviewWeight}
          />
        </div>
      </section>

      <section aria-label="Use as" className="flex flex-col gap-2">
        <h4 className="text-small font-medium">Use as a font variable</h4>
        <p className="text-tiny text-default-500">
          Sets <code>--nxt-font-*</code>. Change the variable later to swap fonts everywhere.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {ROLES.map((r) => (
            <ActionButton
              key={r.name}
              size="sm"
              tone="ghost"
              className="border border-default-200"
              onPress={() => setRole(r.name)}
            >
              {roleSet(r.name) ? `${r.label} ✓` : `Set as ${r.label}`}
            </ActionButton>
          ))}
        </div>
      </section>

      <section aria-label="Loading" className="flex flex-col gap-2">
        <Switch
          size="sm"
          isSelected={font.preload}
          isDisabled={!font.active}
          onValueChange={(preload) => onChange({ ...font, preload })}
        >
          <span className="text-small">Preload the main file (faster first paint)</span>
        </Switch>
        {over ? (
          <p role="status" className="text-tiny text-warning">
            Active fonts total {weight.files} files, {kb(weight.bytes)}. More than{" "}
            {FONT_SOFT_LIMIT_FILES} files or {kb(FONT_SOFT_LIMIT_BYTES)} slows the first view. Turn
            off fonts you do not use.
          </p>
        ) : (
          <p className="text-tiny text-default-500">
            Active fonts: {weight.files} files, {kb(weight.bytes)}.
          </p>
        )}
      </section>

      <section aria-label="Files">
        <h4 className="pb-1 text-small font-medium">Files ({font.files.length})</h4>
        <ul className="max-h-40 overflow-y-auto rounded-large border border-divider text-tiny">
          {font.files.map((f) => (
            <li
              key={f.file}
              className="flex items-center justify-between gap-2 border-b border-divider px-3 py-1.5 last:border-b-0"
            >
              <span className="truncate">
                {weightLabel(f)} · {f.style} · {f.subset}
              </span>
              <span className="shrink-0 text-default-500">
                {f.format} · {kb(f.bytes)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Remove" className="flex flex-col gap-2 border-t border-divider pt-3">
        {use.total > 0 ? (
          <p role="status" className="text-tiny text-default-600">
            In use, so it cannot be removed yet: {usageText(use)}. Point them at another font first.
          </p>
        ) : confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-small">Remove {font.family}?</span>
            <ActionButton size="sm" tone="danger" isLoading={busy} onPress={() => void remove()}>
              Remove
            </ActionButton>
            <ActionButton size="sm" tone="ghost" onPress={() => setConfirming(false)}>
              Keep
            </ActionButton>
          </div>
        ) : (
          <div>
            <ActionButton size="sm" tone="danger-ghost" onPress={() => setConfirming(true)}>
              Remove font
            </ActionButton>
          </div>
        )}
      </section>
    </div>
  );
}
