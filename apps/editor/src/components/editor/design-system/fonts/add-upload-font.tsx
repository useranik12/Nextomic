"use client";

import { Checkbox } from "@heroui/react";
import type { ProjectFont } from "@nextomic/schema";
import { useState } from "react";
import { uploadFontAction } from "@/app/(builder)/editor/[id]/font-actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { useEditorStore } from "../../store/editor-store";

interface Entry {
  file: File;
  weight: string;
  weightMax: string;
  variable: boolean;
  style: "normal" | "italic";
}

const CATEGORIES = [
  { value: "sans-serif", label: "Sans serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "display", label: "Display" },
  { value: "handwriting", label: "Handwriting" },
  { value: "other", label: "Other" }
];

const WEIGHT_WORDS: [RegExp, number][] = [
  [/thin|hairline/i, 100],
  [/extra-?light|ultra-?light/i, 200],
  [/light/i, 300],
  [/medium/i, 500],
  [/semi-?bold|demi-?bold/i, 600],
  [/extra-?bold|ultra-?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700]
];

/** Weight and style are guessed from the file name; the user can correct them. */
function guess(file: File): Entry {
  const name = file.name;
  const weight = WEIGHT_WORDS.find(([re]) => re.test(name))?.[1] ?? 400;
  return {
    file,
    weight: String(weight),
    weightMax: "900",
    variable: /variable|\[wght\]/i.test(name),
    style: /italic|oblique/i.test(name) ? "italic" : "normal"
  };
}

const STYLES = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" }
];

/** Upload woff2, woff, ttf or otf files as one font family. The format is read from the bytes. */
export function AddUploadFont({
  onInstalled
}: {
  onInstalled: (font: ProjectFont) => Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [family, setFamily] = useState("");
  const [category, setCategory] = useState("sans-serif");
  const [license, setLicense] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(list: FileList | null) {
    if (!list) return;
    const next = [...entries, ...[...list].map(guess)].slice(0, 12);
    setEntries(next);
    const first = next[0];
    if (!family && first) {
      setFamily(
        first.file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_ ]*(variable|regular|bold|italic|light|medium|thin|black)\b.*$/i, "")
          .replace(/[-_]+/g, " ")
          .trim()
      );
    }
  }

  function patch(index: number, change: Partial<Entry>) {
    setEntries(entries.map((e, i) => (i === index ? { ...e, ...change } : e)));
  }

  async function upload() {
    const form = new FormData();
    form.set(
      "meta",
      JSON.stringify({
        family: family.trim(),
        category,
        license: license.trim(),
        rights,
        files: entries.map((e) => ({
          weight: Number(e.weight),
          weightMax: e.variable ? Number(e.weightMax) : undefined,
          style: e.style
        }))
      })
    );
    for (const e of entries) form.append("file", e.file);
    setBusy(true);
    setError(null);
    const result = await uploadFontAction(useEditorStore.getState().projectId, form);
    if (result.error !== null) {
      setBusy(false);
      return setError(result.error);
    }
    await onInstalled(result.data);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-large border-2 border-dashed px-4 py-8 text-center transition-colors duration-300 focus-within:ring-2 focus-within:ring-default-800/40 " +
          (dragging
            ? "border-default-800 bg-default-100"
            : "border-default-300 hover:border-default-500 hover:bg-default-50")
        }
      >
        <span className="text-small font-medium">Drop font files here, or click to choose</span>
        <span className="text-tiny text-default-500">
          woff2, woff, ttf or otf, up to 2 MB each, 12 files
        </span>
        <input
          type="file"
          multiple
          accept=".woff2,.woff,.ttf,.otf"
          className="sr-only"
          aria-label="Font files"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {entries.length > 0 ? (
        <>
          <ul className="flex flex-col gap-2">
            {entries.map((e, i) => (
              <li
                key={`${e.file.name}-${i}`}
                className="flex flex-wrap items-end gap-2 rounded-large border border-divider p-2"
              >
                <span className="w-full truncate text-tiny font-medium">{e.file.name}</span>
                <div className="w-24">
                  <FormInput
                    compact
                    type="number"
                    label={e.variable ? "Min weight" : "Weight"}
                    value={e.weight}
                    onValueChange={(weight) => patch(i, { weight })}
                  />
                </div>
                {e.variable ? (
                  <div className="w-24">
                    <FormInput
                      compact
                      type="number"
                      label="Max weight"
                      value={e.weightMax}
                      onValueChange={(weightMax) => patch(i, { weightMax })}
                    />
                  </div>
                ) : null}
                <div className="w-28">
                  <SelectField
                    compact
                    label="Style"
                    options={STYLES}
                    value={e.style}
                    onValueChange={(style) => patch(i, { style: style as Entry["style"] })}
                  />
                </div>
                <Checkbox
                  size="sm"
                  isSelected={e.variable}
                  onValueChange={(variable) => patch(i, { variable })}
                >
                  Variable
                </Checkbox>
                <ActionButton
                  size="sm"
                  tone="danger-ghost"
                  onPress={() => setEntries(entries.filter((_, j) => j !== i))}
                >
                  Remove
                </ActionButton>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FormInput compact label="Family name" value={family} onValueChange={setFamily} />
            <SelectField
              compact
              label="Category"
              options={CATEGORIES}
              value={category}
              onValueChange={setCategory}
            />
            <FormInput
              compact
              label="License"
              placeholder="OFL-1.1, Commercial…"
              value={license}
              onValueChange={setLicense}
            />
          </div>
          <Checkbox size="sm" isSelected={rights} onValueChange={setRights}>
            I have the right to use and distribute this font on websites.
          </Checkbox>
          {error ? (
            <p role="alert" className="text-tiny text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <ActionButton
              size="sm"
              isLoading={busy}
              isDisabled={!rights || family.trim() === ""}
              onPress={() => void upload()}
            >
              Upload font
            </ActionButton>
          </div>
        </>
      ) : null}
    </div>
  );
}
