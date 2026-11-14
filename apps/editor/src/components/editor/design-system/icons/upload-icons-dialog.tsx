"use client";

import { slugIconName, type IconLibrary } from "@nextomic/schema";
import { useRef, useState, type ReactNode } from "react";
import { uploadIconLibraryAction } from "@/app/(builder)/editor/[id]/icon-actions";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { CheckField, Toggle } from "@/components/ui/toggles";
import { Icon } from "@/lib/icons/Icon";

type Kind = "font" | "svg" | "iconify-json";

const KINDS: { id: Kind; label: string; accept: string; hint: string }[] = [
  {
    id: "font",
    label: "Icon font",
    accept: ".zip,.woff2,.woff,.ttf,.otf,.json,.css",
    hint: "The IcoMoon or Fontello zip, or the font file plus selection.json, config.json or CSS"
  },
  {
    id: "svg",
    label: "SVG icons",
    accept: ".zip,.svg",
    hint: "A zip of .svg files, or one or many .svg files"
  },
  {
    id: "iconify-json",
    label: "Iconify JSON",
    accept: ".zip,.json",
    hint: "An Iconify icon set .json, or a zip with it"
  }
];

function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-1 pl-5 text-xs text-body">{children}</ol>;
}

/** How to make or upload each kind, collapsed so the form stays short. */
function Guide({ kind }: { kind: Kind }) {
  return (
    <details open={kind === "font"} className="rounded-xl border border-border px-3 py-2 text-xs">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {kind === "font"
          ? "How to create or upload an icon font"
          : kind === "svg"
            ? "How SVG icons are read"
            : "Where to get an Iconify set"}
      </summary>
      <div className="flex flex-col gap-2 pt-2">
        {kind === "font" ? (
          <>
            <Steps>
              <li>
                Make the font at icomoon.io/app (Generate Font, then Download) or fontello.com (pick
                icons, then Download webfont).
              </li>
              <li>Select the .zip you downloaded.</li>
              <li>
                Or, with an unzipped font, select together the font file (.woff2, .woff or .ttf) and
                the file that lists the icons: selection.json (IcoMoon), config.json (Fontello) or
                the .css file.
              </li>
            </Steps>
            <p className="text-muted">
              Up to 4 font files, one per format, 2 MB each. The CSS is only read to find the icon
              names; the builder writes its own. Icon fonts draw one color. For multicolor or
              animated icons, use SVG icons.
            </p>
          </>
        ) : null}
        {kind === "svg" ? (
          <p className="text-muted">
            Each file becomes one icon, named after the file. Choose the files or one .zip of them.
            SVGs need a viewBox (or width and height). Scripts and event handlers are removed;
            simple animation is kept. Up to 1000 files, 200 KB each.
          </p>
        ) : null}
        {kind === "iconify-json" ? (
          <p className="text-muted">
            Use an icon set exported as Iconify JSON, for example the icons.json inside an
            @iconify-json package or a set from icon-sets.iconify.design, as a file or in a .zip.
            Icons with unsafe markup are left out.
          </p>
        ) : null}
      </div>
    </details>
  );
}

const size = (n: number) => (n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`);

/**
 * Upload your own icons: an icon font (IcoMoon, Fontello or font plus CSS), SVG files, or an
 * Iconify JSON set. The files are checked on the server; the result joins the project's libraries.
 */
export function UploadIconsDialog({
  projectId,
  takenKeys,
  onAdded,
  onClose
}: {
  projectId: string;
  takenKeys: string[];
  onAdded: (library: IconLibrary) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>("font");
  const [name, setName] = useState("");
  const [license, setLicense] = useState("");
  const [keepColors, setKeepColors] = useState(false);
  const [rights, setRights] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ library: IconLibrary; skipped: string[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = KINDS.find((k) => k.id === kind)!;
  const key = slugIconName(name).slice(0, 40);

  async function submit() {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("meta", JSON.stringify({ name, kind, keepColors, license, rights, takenKeys }));
    for (const f of files) form.append("file", f);
    const res = await uploadIconLibraryAction(projectId, form);
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    onAdded(res.data.library);
    if (res.data.skipped.length === 0) onClose();
    else setDone(res.data);
  }

  if (done) {
    return (
      <Dialog
        isOpen
        onClose={onClose}
        size="md"
        title={`${done.library.name} added`}
        description={`${done.library.count} icons added. Some files were left out.`}
        footer={
          <ActionButton tone="primary" size="md" onPress={onClose}>
            Done
          </ActionButton>
        }
      >
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-xs text-body">
          {done.skipped.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Dialog>
    );
  }

  return (
    <Dialog
      isOpen
      onClose={onClose}
      size="md"
      isDismissable={!busy}
      title="Upload icons"
      description="Add your own icon font, SVG files or an Iconify set."
      footer={
        <>
          <ActionButton tone="secondary" size="md" onPress={onClose} isDisabled={busy}>
            Cancel
          </ActionButton>
          <ActionButton
            tone="primary"
            size="md"
            isLoading={busy}
            isDisabled={name.trim() === "" || key === "" || files.length === 0 || !rights}
            onPress={() => void submit()}
          >
            Upload
          </ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="What to upload" className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              data-tip={k.hint}
              onClick={() => {
                setKind(k.id);
                setFiles([]);
                setError(null);
              }}
              className={
                "rounded-full px-3 py-1 text-sm transition-colors duration-300 " +
                (kind === k.id ? "bg-default-hover text-foreground" : "text-body hover:bg-default")
              }
            >
              {k.label}
            </button>
          ))}
        </div>
        <Guide kind={kind} />
        <FormInput
          compact
          label="Library name"
          value={name}
          onValueChange={setName}
          maxLength={60}
          description={key ? `Used as ${key}` : undefined}
        />
        <FormInput
          compact
          label="License (optional)"
          placeholder="for example MIT"
          value={license}
          onValueChange={setLicense}
          maxLength={80}
        />
        {kind === "svg" ? (
          <Toggle
            label="Keep original colors"
            tip="Off: fills and strokes become the text color, like most icon sets. On: the files' own colors stay."
            isSelected={keepColors}
            onChange={setKeepColors}
          />
        ) : null}
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            hidden
            multiple={kind !== "iconify-json"}
            accept={current.accept}
            aria-label="Choose the files to upload"
            data-testid="icon-upload-input"
            onChange={(e) => {
              setFiles([...(e.target.files ?? [])]);
              setError(null);
              e.target.value = "";
            }}
          />
          <div>
            <ActionButton
              tone="secondary"
              size="sm"
              startContent={<Icon name="ph:upload-simple" width={14} height={14} />}
              onPress={() => input.current?.click()}
            >
              Choose files
            </ActionButton>
          </div>
          {files.length > 0 ? (
            <ul
              aria-label="Chosen files"
              className="flex max-h-28 flex-col gap-0.5 overflow-y-auto text-xs text-body"
            >
              {files.slice(0, 50).map((f) => (
                <li key={f.name + f.size} className="flex justify-between gap-3">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-muted">{size(f.size)}</span>
                </li>
              ))}
              {files.length > 50 ? (
                <li className="text-muted">and {files.length - 50} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <CheckField
          label="I have the right to use and distribute these icons on websites."
          isSelected={rights}
          onChange={setRights}
        />
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
