"use client";

import {
  glyphChar,
  iconFontFaceCss,
  iconFontFamily,
  ICON_CATALOG,
  ICONIFY_MAX_BYTES,
  type IconCatalogEntry,
  type IconLibrary
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { Busy } from "@/components/ui/busy";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { Toggle } from "@/components/ui/toggles";
import { Icon } from "@/lib/icons/Icon";
import { IconSetRow, type IconChip } from "./icon-set-row";
import { UpdateIconDialog } from "./update-icon-dialog";
import { UploadIconsDialog } from "./upload-icons-dialog";
import { useIconLibraries } from "./use-icon-libraries";
import { useIconUsage } from "./use-icon-usage";

const count = (n: number) => n.toLocaleString("en-US");

function chipsFor(x: {
  animated: boolean;
  palette: boolean;
  requiresAttribution: boolean;
  brand: boolean;
  mode?: IconLibrary["mode"];
  source?: IconLibrary["source"];
}): IconChip[] {
  const chips: IconChip[] = [];
  if (x.source && x.source !== "iconify")
    chips.push({ label: "Custom", tip: "Uploaded by you, not from the catalog." });
  if (x.mode === "font")
    chips.push({
      label: "Icon font",
      tip: "Drawn with a font file. One color only; use SVG icons for multicolor or animated icons."
    });
  if (x.animated)
    chips.push({ label: "Animated", tip: "Some icons move. They are drawn as inline SVG." });
  if (x.palette)
    chips.push({
      label: "Multicolor",
      tip: "Icons keep their own colors instead of the text color."
    });
  if (x.requiresAttribution)
    chips.push({
      label: "Credit required",
      tip: "The license asks you to credit the author. The export includes a credits file.",
      tone: "warning"
    });
  if (x.brand)
    chips.push({
      label: "Brand marks",
      tip: "The files are free to use, but the logos are trademarks of their owners."
    });
  return chips;
}

const factsOf = (lib: Pick<IconLibrary, "count" | "author" | "license">) =>
  [`${count(lib.count)} icons`, lib.author, lib.license].filter(Boolean).join(" · ");

/**
 * Design System > Fonts & Icons > Icons. Installed libraries first, then the catalog of free sets.
 * Every set is stored per project and drawn as inline SVG, so multicolor and animated icons work.
 */
export function IconsTab({ saveNow }: { saveNow: () => Promise<void> }) {
  const lib = useIconLibraries(saveNow);
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [removing, setRemoving] = useState<IconLibrary | null>(null);
  const usage = useIconUsage(lib.projectId, removing?.key ?? null);
  const [uploading, setUploading] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = (...texts: string[]) =>
    q === "" || texts.some((t) => t.toLowerCase().includes(q));
  const installedKeys = useMemo(() => new Set(lib.libraries.map((l) => l.key)), [lib.libraries]);
  const installed = lib.libraries.filter((l) => matches(l.name, l.key, l.author, l.license));
  const catalog = ICON_CATALOG.filter(
    (c) =>
      !installedKeys.has(c.prefix) && matches(c.name, c.prefix, c.author, c.category, c.license)
  );
  const updateTarget = lib.libraries.find((l) => l.key === updating) ?? null;

  const installAction = (c: IconCatalogEntry) =>
    c.bytes > ICONIFY_MAX_BYTES ? (
      <span
        data-tip={`This set is ${Math.round(c.bytes / 1e6)} MB, over the ${Math.round(ICONIFY_MAX_BYTES / 1e6)} MB install limit.`}
      >
        <ActionButton tone="secondary" size="sm" isDisabled>
          Too large
        </ActionButton>
      </span>
    ) : (
      <ActionButton
        tone="secondary"
        size="sm"
        isLoading={lib.busy.has(c.prefix)}
        startContent={<Icon name="ph:download-simple" width={14} height={14} />}
        onPress={() => void lib.install(c.prefix)}
      >
        Install
      </ActionButton>
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0 max-w-sm flex-1">
          <FormInput
            compact
            aria-label="Search icon sets"
            placeholder="Search sets..."
            value={query}
            onValueChange={setQuery}
            isClearable
            onClear={() => setQuery("")}
            maxLength={60}
            startContent={<Icon name="ph:magnifying-glass" width={14} height={14} />}
          />
        </div>
        <ActionButton
          tone="secondary"
          size="sm"
          startContent={<Icon name="ph:upload-simple" width={14} height={14} />}
          onPress={() => setUploading(true)}
        >
          Upload icons
        </ActionButton>
        <ActionButton
          tone="secondary"
          size="sm"
          isIconOnly
          aria-label="Check for icon updates"
          data-tip="Check for icon updates"
          isLoading={lib.checking}
          onPress={() => void lib.check()}
        >
          <Icon name="ph:arrows-clockwise" width={14} height={14} />
        </ActionButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {lib.checkError ? (
          <p role="alert" className="pt-3 text-xs text-danger">
            {lib.checkError}
          </p>
        ) : null}
        <section aria-label="Installed icon libraries">
          <h4 className="pt-4 text-sm font-semibold text-foreground">Installed</h4>
          {lib.libraries.length === 0 ? (
            <p className="py-3 text-sm text-muted">No icon libraries yet. Install a set below.</p>
          ) : installed.length === 0 ? (
            <p className="py-3 text-sm text-muted">No installed library matches the search.</p>
          ) : (
            <ul>
              {installed.map((l) => {
                const update = lib.updates[l.key];
                return (
                  <IconSetRow
                    key={l.key}
                    name={l.name}
                    samples={l.samples}
                    glyphs={
                      l.mode === "font"
                        ? { family: iconFontFamily(l.key), chars: l.glyphSamples.map(glyphChar) }
                        : undefined
                    }
                    facts={l.version ? `${factsOf(l)} · v${l.version}` : factsOf(l)}
                    chips={chipsFor(l)}
                    libraryKey={l.key}
                    error={lib.errors[l.key]}
                    actions={
                      <>
                        {update ? (
                          <ActionButton
                            tone="primary"
                            size="sm"
                            data-tip={`Version ${update.installed} to ${update.latest}`}
                            isLoading={lib.busy.has(l.key)}
                            startContent={
                              <Icon name="ph:arrows-clockwise" width={14} height={14} />
                            }
                            onPress={() => setUpdating(l.key)}
                          >
                            Update
                          </ActionButton>
                        ) : null}
                        <Toggle
                          aria-label={`Show ${l.name} in the icon picker`}
                          isSelected={l.enabled}
                          onChange={(on) => lib.toggle(l.key, on)}
                        />
                        <ActionButton
                          tone="danger-ghost"
                          size="sm"
                          isIconOnly
                          aria-label={`Remove ${l.name}`}
                          data-tip="Remove"
                          onPress={() => setRemoving(l)}
                        >
                          <Icon name="ph:trash" width={14} height={14} />
                        </ActionButton>
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>
        <section aria-label="Icon sets">
          <h4 className="flex items-center gap-1.5 pt-5 text-sm font-semibold text-foreground">
            Icon sets
            <InfoTip text="Free icon sets from Iconify. Installing copies the set into this project and draws icons as inline SVG, so animated and multicolor icons work. Updates are offered when a newer release exists." />
          </h4>
          {lib.checking && lib.libraries.length > 0 ? (
            <Busy label="Checking installed sets for updates" className="pt-2" />
          ) : null}
          {catalog.length === 0 ? (
            <p className="py-3 text-sm text-muted">
              {q === "" ? "Every set in the catalog is installed." : "No set matches the search."}
            </p>
          ) : (
            <ul>
              {catalog.map((c) => (
                <IconSetRow
                  key={c.prefix}
                  name={c.name}
                  samples={c.samples}
                  facts={factsOf({ count: c.total, author: c.author, license: c.license })}
                  chips={chipsFor(c)}
                  libraryKey={c.prefix}
                  error={lib.errors[c.prefix]}
                  actions={installAction(c)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
      <style>
        {lib.libraries
          .filter((l) => l.mode === "font")
          .map((l) => iconFontFaceCss(l, `/icons/${lib.projectId}`))
          .join("")}
      </style>
      {uploading ? (
        <UploadIconsDialog
          projectId={lib.projectId}
          takenKeys={lib.libraries.map((l) => l.key)}
          onAdded={(library) => void lib.addUploaded(library)}
          onClose={() => setUploading(false)}
        />
      ) : null}
      {updateTarget ? (
        <UpdateIconDialog
          library={updateTarget}
          projectId={lib.projectId}
          applying={lib.busy.has(updateTarget.key)}
          onClose={() => setUpdating(null)}
          onApply={async (version) => {
            if (await lib.install(updateTarget.key, version)) setUpdating(null);
          }}
        />
      ) : null}
      <Dialog
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        size="sm"
        title={`Remove ${removing?.name ?? ""}`}
        description={
          usage.used
            ? "Icons from this library are in use, so it cannot be removed yet."
            : "Its icons leave the picker. Press Save in the Design System to keep the change, or Discard to bring it back."
        }
        footer={
          <>
            <ActionButton tone="secondary" size="md" onPress={() => setRemoving(null)}>
              Cancel
            </ActionButton>
            <ActionButton
              tone="danger"
              size="md"
              isDisabled={usage.checking || usage.used}
              onPress={() => {
                if (removing) lib.remove(removing.key);
                setRemoving(null);
              }}
            >
              Remove
            </ActionButton>
          </>
        }
      >
        {usage.checking ? <p className="text-xs text-muted">Checking where it is used...</p> : null}
        {usage.error ? (
          <p role="alert" className="text-xs text-danger">
            {usage.error}
          </p>
        ) : null}
        {usage.used ? (
          <ul
            aria-label="Where it is used"
            className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-body"
          >
            {usage.list.map((u) => (
              <li key={`${u.kind}:${u.id}`}>
                {u.kind === "page" ? "Page" : u.kind === "template" ? "Template" : ""} {u.name}
              </li>
            ))}
          </ul>
        ) : null}
      </Dialog>
    </div>
  );
}
