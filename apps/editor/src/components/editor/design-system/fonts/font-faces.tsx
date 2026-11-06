"use client";

import { Checkbox } from "@heroui/react";
import { fontStack, sortFontFiles, type FontFile, type ProjectFont } from "@nextomic/schema";
import { useRef, useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../../store/editor-store";
import { detectFace, type DetectedFace } from "./detect-face";
import {
  WEIGHT_OPTIONS,
  fileKey,
  hasDuplicateVariation,
  mergeFiles,
  weightLabel
} from "./font-model";
import { uploadFaces, type FaceInput } from "./upload-faces";

const SAMPLE = "The quick brown fox jumps over the lazy dog";
const ACCEPT = ".woff2,.woff,.ttf,.otf";
const STYLES = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" }
];
const kb = (bytes: number): string => `${Math.max(1, Math.round(bytes / 1000))} KB`;

function IconAction({
  label,
  children,
  onPress,
  danger,
  disabled
}: {
  label: string;
  children: React.ReactNode;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onPress}
      className={
        "flex h-8 w-8 items-center justify-center rounded-medium border border-divider text-default-700 transition-colors duration-300 disabled:opacity-40 " +
        (danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-default-100")
      }
    >
      {children}
    </button>
  );
}

function WeightAndStyle({
  label,
  weight,
  weightMax,
  style,
  onWeight,
  onStyle
}: {
  label: string;
  weight: number;
  weightMax?: number | undefined;
  style: "normal" | "italic";
  onWeight: (weight: number) => void;
  onStyle: (style: "normal" | "italic") => void;
}) {
  return (
    <>
      <div className="w-44">
        {weightMax ? (
          <p className="px-1 text-small">{weightLabel({ weight, weightMax })}</p>
        ) : (
          <SelectField
            compact
            hideLabel
            label={`Weight of ${label}`}
            options={WEIGHT_OPTIONS}
            value={String(weight)}
            onValueChange={(w) => onWeight(Number(w))}
          />
        )}
      </div>
      <div className="w-28">
        <SelectField
          compact
          hideLabel
          label={`Style of ${label}`}
          options={STYLES}
          value={style}
          onValueChange={(s) => onStyle(s as "normal" | "italic")}
        />
      </div>
    </>
  );
}

interface Pending extends DetectedFace {
  file: File | null;
}

/**
 * The faces of one font (Bricks "font variations"), lowest weight first. A custom font's faces are
 * edited here: add one (pick a file and its weight and style are read from it), change the weight
 * or style, replace the file of a saved face, or upload many files at once and let the builder
 * sort them. A Google font's faces can only be removed.
 */
export function FontFaces({
  font,
  onChange
}: {
  font: ProjectFont;
  onChange: (next: ProjectFont) => void;
}) {
  const editable = font.source === "upload";
  const stack = fontStack(font);
  // Saved with the font: without it the font is not used on the site and text falls back.
  const rights = font.rights;
  const setRights = (value: boolean) => onChange({ ...font, rights: value });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const bulk = useRef<HTMLInputElement>(null);
  const replacing = useRef<number>(-1);
  const replace = useRef<HTMLInputElement>(null);
  const choose = useRef<HTMLInputElement>(null);
  const faces = sortFontFiles(font.files);

  const commit = (files: FontFile[]) => onChange({ ...font, files: sortFontFiles(files) });

  async function send(inputs: FaceInput[], what: string): Promise<FontFile[] | null> {
    setBusy(what);
    setError(null);
    setNotice(null);
    const result = await uploadFaces(useEditorStore.getState().projectId, font, inputs);
    setBusy(null);
    if ("error" in result) {
      setError(result.error);
      return null;
    }
    return result.files;
  }

  async function addMany(list: FileList | null) {
    if (!list || list.length === 0) return;
    const inputs: FaceInput[] = [];
    for (const file of [...list]) inputs.push({ file, ...(await detectFace(file)) });
    const stored = await send(inputs, "bulk");
    if (!stored) return;
    commit(mergeFiles(font.files, stored));
    setNotice(
      `Added ${stored.length} face${stored.length === 1 ? "" : "s"}, ordered by weight: ${sortFontFiles(
        stored
      )
        .map(
          (f) =>
            `${f.weightMax ? `${f.weight}-${f.weightMax}` : f.weight}${f.style === "italic" ? " italic" : ""}`
        )
        .join(", ")}.`
    );
  }

  async function pickForPending(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const detected = await detectFace(file);
    setPending({ file, ...detected });
  }

  async function addPending() {
    if (!pending?.file) return;
    const { file, weight, weightMax, style } = pending;
    const stored = await send(
      [{ file, weight, ...(weightMax ? { weightMax } : {}), style }],
      "add"
    );
    if (!stored) return;
    commit(mergeFiles(font.files, stored));
    setPending(null);
  }

  async function replaceFile(list: FileList | null) {
    const file = list?.[0];
    const index = replacing.current;
    const face = faces[index];
    if (!file || !face) return;
    const stored = await send(
      [
        {
          file,
          weight: face.weight,
          ...(face.weightMax ? { weightMax: face.weightMax } : {}),
          style: face.style
        }
      ],
      `replace-${index}`
    );
    if (stored) commit(mergeFiles(font.files, stored));
  }

  function change(index: number, patch: Partial<FontFile>) {
    const files = faces.map((f, i) => (i === index ? { ...f, ...patch } : f));
    if (hasDuplicateVariation(files)) return setError("Two faces would share a weight and style.");
    setError(null);
    commit(files);
  }

  function remove(index: number) {
    setError(null);
    commit(faces.filter((_, i) => i !== index));
  }

  const clash = pending?.file ? faces.some((f) => fileKey(f) === fileKey(pending)) : false;
  return (
    <section aria-label="Font variations" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-small font-semibold uppercase">
          Font variations ({faces.length})
          <InfoTip text="A font is a group of faces that share one name. Each face is one file for one weight and style, such as Bold or Light Italic." />
        </h3>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              size="sm"
              tone="ghost"
              className="border border-default-200"
              isDisabled={!rights}
              isLoading={busy === "bulk"}
              onPress={() => bulk.current?.click()}
            >
              <Icon name="ph:upload-simple" width={14} height={14} />
              Upload font files
            </ActionButton>
            <ActionButton
              size="sm"
              tone="ghost"
              className="border border-default-200"
              isDisabled={!rights || pending !== null}
              onPress={() => setPending({ file: null, weight: 400, style: "normal" })}
            >
              <Icon name="ph:plus" width={14} height={14} />
              Add fontface
            </ActionButton>
            <InfoTip text="Upload font files picks every file at once. The weight and style of each is read from the file and the faces are sorted from light to heavy for you. You can fix any of them afterwards." />
          </div>
        ) : null}
      </div>
      {editable ? (
        <Checkbox size="sm" isSelected={rights} onValueChange={setRights}>
          I have the right to use and distribute these fonts on websites.
        </Checkbox>
      ) : null}
      {editable && !rights ? (
        <p role="status" className="text-tiny text-warning">
          Not confirmed: this font is not used on the site. Text that names it falls back to the
          next font until you tick the box.
        </p>
      ) : null}
      <input
        ref={bulk}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        aria-label="Upload font files"
        tabIndex={-1}
        onChange={(e) => {
          void addMany(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={replace}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Replace the font file"
        tabIndex={-1}
        onChange={(e) => {
          void replaceFile(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-tiny text-default-600">
          {notice}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {faces.map((f, i) => (
          <li
            key={`${fileKey(f)}-${f.file}`}
            className="flex flex-wrap items-center gap-3 rounded-large bg-default-100 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p
                style={{ fontFamily: stack, fontWeight: f.weight, fontStyle: f.style }}
                className="truncate text-medium"
              >
                {SAMPLE}
              </p>
              <p className="truncate text-tiny text-default-500">
                {f.file} · {f.subset} · {kb(f.bytes)}
              </p>
            </div>
            {editable ? (
              <WeightAndStyle
                label={f.file}
                weight={f.weight}
                weightMax={f.weightMax}
                style={f.style}
                onWeight={(weight) => change(i, { weight })}
                onStyle={(style) => change(i, { style })}
              />
            ) : (
              <p className="px-1 text-small text-default-600">
                {weightLabel(f)} · {f.style}
              </p>
            )}
            {editable ? (
              <IconAction
                label={`Change the font file of ${f.file}`}
                disabled={!rights || busy !== null}
                onPress={() => {
                  replacing.current = i;
                  replace.current?.click();
                }}
              >
                <Icon name="ph:pencil-simple" width={14} height={14} />
              </IconAction>
            ) : null}
            <IconAction label={`Delete the face ${f.file}`} danger onPress={() => remove(i)}>
              <Icon name="ph:trash" width={14} height={14} />
            </IconAction>
          </li>
        ))}
        {faces.length === 0 && pending === null ? (
          <li className="rounded-large border border-dashed border-default-300 p-4 text-small text-default-500">
            {editable
              ? "This font has no faces yet. Tick the box above, then use Add fontface or Upload font files."
              : "This font has no faces."}
          </li>
        ) : null}
        {pending ? (
          <li className="flex flex-wrap items-center gap-3 rounded-large border border-dashed border-default-400 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-medium">
                {pending.file ? pending.file.name : "New fontface"}
              </p>
              <p className="text-tiny text-default-500">
                {pending.file
                  ? "Weight and style were read from the file. Change them if they are wrong."
                  : "Choose a font file, or set them first."}
              </p>
              {clash ? (
                <p role="alert" className="text-tiny text-warning">
                  A face with this weight and style exists. Adding replaces its file.
                </p>
              ) : null}
            </div>
            <WeightAndStyle
              label="the new fontface"
              weight={pending.weight}
              weightMax={pending.weightMax}
              style={pending.style}
              onWeight={(weight) => setPending({ ...pending, weight })}
              onStyle={(style) => setPending({ ...pending, style })}
            />
            <input
              ref={choose}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Choose the font file"
              tabIndex={-1}
              onChange={(e) => {
                void pickForPending(e.target.files);
                e.target.value = "";
              }}
            />
            <ActionButton
              size="sm"
              tone="ghost"
              className="border border-default-200"
              onPress={() => choose.current?.click()}
            >
              <Icon name="ph:upload-simple" width={14} height={14} />
              {pending.file ? "Change file" : "Choose file"}
            </ActionButton>
            <IconAction
              label="Pick from the media library (arrives with the Media manager)"
              disabled
              onPress={() => undefined}
            >
              <Icon name="ph:folder-open" width={14} height={14} />
            </IconAction>
            <ActionButton
              size="sm"
              isDisabled={!pending.file}
              isLoading={busy === "add"}
              onPress={() => void addPending()}
            >
              Add
            </ActionButton>
            <ActionButton size="sm" tone="ghost" onPress={() => setPending(null)}>
              Cancel
            </ActionButton>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
