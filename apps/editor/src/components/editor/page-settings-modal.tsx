"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch } from "@heroui-v2/react";
import {
  VERSION_LIMIT_MAX,
  VERSION_LIMIT_MIN,
  effectiveVersionLimit,
  pageNameSchema,
  pageSeoSchema,
  resolveTheme
} from "@nextomic/schema";
import { useState } from "react";
import {
  deletePageAction,
  duplicatePageAction,
  listPagesAction
} from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { openPage } from "./open-item";
import { BoltInput } from "./right-panel/bolt-input";
import { StatusField } from "./right-panel/status-field";
import { useEditorStore } from "./store/editor-store";
import type { PageSummary } from "@/server/pages";

// General, SEO, Appearance (theme) and Language. Templates, Rendering and Custom code appear as the
// features behind them are built (docs/ui-reference.md 4.11).
const LOCALES = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["bn", "Bengali"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"]
].map(([value, label]) => ({ value: value as string, label: `${label} (${value})` }));

/**
 * How many saved versions this page keeps (5 to 200). Greyed out, with a tip, while version control
 * is off in App Settings. Empty follows the app-wide limit.
 */
function VersionLimit() {
  const settings = useEditorStore((s) => s.doc?.settings);
  const project = useEditorStore((s) => s.project);
  const update = useEditorStore((s) => s.updatePageSettings);
  const own = settings?.versionLimit ?? null;
  const [text, setText] = useState(own === null ? "" : String(own));
  const globalOff = !project.versionControl;
  const pageOn = settings?.versionControl ?? true;
  const off = globalOff || !pageOn;
  const inherited = effectiveVersionLimit(project, { versionLimit: null });

  function commit(raw: string) {
    if (raw.trim() === "") {
      update({ versionLimit: null });
      return setText("");
    }
    const n = Math.round(Number(raw));
    const next = Number.isFinite(n)
      ? Math.min(VERSION_LIMIT_MAX, Math.max(VERSION_LIMIT_MIN, n))
      : (own ?? inherited);
    update({ versionLimit: next });
    setText(String(next));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <Switch
          isSelected={pageOn && !globalOff}
          isDisabled={globalOff}
          onValueChange={(on) => update({ versionControl: on })}
        >
          <span className="text-small font-medium text-foreground">
            Enable version history for this page
          </span>
        </Switch>
        <InfoTip
          label="Version history for this page"
          text={
            globalOff
              ? "Version control is off for the whole app. Turn it on in App Settings first."
              : "Off: saving this page makes no new snapshots. Other pages are not affected."
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-small font-medium text-foreground">History limit</span>
          <InfoTip
            label="History limit"
            text={
              globalOff
                ? "Version control is off. Turn it on in App Settings to keep a history of this page."
                : !pageOn
                  ? "Version history is off for this page. Turn it on above."
                  : `How many saved versions this page keeps, from ${VERSION_LIMIT_MIN} to ${VERSION_LIMIT_MAX}. When it is full the oldest version is deleted. Leave empty to use the app-wide limit (${inherited}).`
            }
          />
        </div>
        <FormInput
          compact
          aria-label="History limit"
          type="number"
          min={VERSION_LIMIT_MIN}
          max={VERSION_LIMIT_MAX}
          isDisabled={off}
          placeholder={`App default (${inherited})`}
          value={text}
          onValueChange={setText}
          onBlur={() => commit(text)}
          description={
            off
              ? globalOff
                ? "Version control is off. Turn it on from App Settings."
                : "Version history is off for this page."
              : `${VERSION_LIMIT_MIN} to ${VERSION_LIMIT_MAX} versions. Older ones are deleted.`
          }
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-small font-semibold text-foreground">{children}</h3>;
}

export function PageSettingsModal({
  pages,
  onPagesChange,
  saveNow,
  onClose
}: {
  pages: PageSummary[];
  onPagesChange: (pages: PageSummary[]) => void;
  saveNow: () => Promise<void>;
  onClose: () => void;
}) {
  const doc = useEditorStore((s) => s.doc);
  const pageId = useEditorStore((s) => s.page?.id);
  const updateMeta = useEditorStore((s) => s.updatePageMeta);
  const updateSettings = useEditorStore((s) => s.updatePageSettings);
  const themes = useEditorStore((s) => s.project.themes);
  const route = useEditorStore((s) => s.doc?.route ?? "/");
  const auto = resolveTheme(themes, { pageId: pageId ?? "", route }).theme;
  const themeLabel = auto ? `Auto (${auto.name})` : "Auto";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  if (!doc || !pageId) return null;

  const nameValid = pageNameSchema.safeParse(doc.name).success;
  const seo = doc.settings.seo;
  const seoCheck = pageSeoSchema.safeParse(seo);
  const urlError = (field: "canonical" | "ogImage") =>
    seoCheck.success || !seoCheck.error.issues.some((i) => i.path[0] === field)
      ? undefined
      : "Use an http(s) URL or a path starting with /";
  const setSeo = (patch: Partial<typeof seo>) => updateSettings({ seo: { ...seo, ...patch } });

  async function duplicate() {
    const projectId = useEditorStore.getState().projectId;
    setDuplicating(true);
    setError(null);
    await saveNow();
    const result = await duplicatePageAction(projectId, pageId as string);
    if (result.error !== null) {
      setDuplicating(false);
      setError(result.error);
      return;
    }
    const list = await listPagesAction(projectId);
    if (list.error === null) onPagesChange(list.data);
    const openError = await openPage(result.data.id);
    setDuplicating(false);
    if (openError) setError(openError);
    else onClose();
  }

  async function remove() {
    const projectId = useEditorStore.getState().projectId;
    const result = await deletePageAction(projectId, pageId as string);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    const list = await listPagesAction(projectId);
    if (list.error === null) {
      onPagesChange(list.data);
      const next = list.data[0];
      if (next) await openPage(next.id);
    }
    onClose();
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>Page settings</ModalHeader>
        <ModalBody className="gap-3">
          <SectionTitle>General</SectionTitle>
          <BoltInput
            label="Name"
            value={doc.name}
            onValueChange={(name) => updateMeta({ name })}
            isInvalid={!nameValid}
            errorMessage={nameValid ? undefined : "A page needs a name."}
          />
          <BoltInput
            label="Internal description"
            value={doc.settings.description}
            onValueChange={(description) => updateSettings({ description })}
          />
          <StatusField
            status={doc.settings.status}
            scheduledAt={doc.settings.scheduledAt}
            onChange={(change) => updateSettings(change)}
            tip="Draft pages stay out of publishing. Publish, Save as draft and Unpublish in the top bar act on the project."
          />
          <Switch
            isSelected={doc.settings.isHome}
            onValueChange={(isHome) => updateSettings({ isHome })}
          >
            Home page
          </Switch>
          <SectionTitle>SEO</SectionTitle>
          <BoltInput
            label="SEO title"
            value={seo.title}
            onValueChange={(title) => setSeo({ title })}
            isInvalid={seo.title.length > 120}
            errorMessage={seo.title.length > 120 ? "Keep it under 120 characters." : undefined}
          />
          <BoltInput
            label="Meta description"
            value={seo.description}
            onValueChange={(description) => setSeo({ description })}
            isInvalid={seo.description.length > 300}
            errorMessage={
              seo.description.length > 300 ? "Keep it under 300 characters." : undefined
            }
          />
          <BoltInput
            label="Canonical URL"
            placeholder="https://example.com/page"
            value={seo.canonical}
            onValueChange={(canonical) => setSeo({ canonical })}
            isInvalid={Boolean(urlError("canonical"))}
            errorMessage={urlError("canonical")}
          />
          <SelectField
            compact
            label="Search engines"
            value={seo.robots}
            onValueChange={(robots) =>
              setSeo({ robots: robots === "noindex" ? "noindex" : "index" })
            }
            options={[
              { value: "index", label: "Allow indexing" },
              { value: "noindex", label: "Hide from search (noindex)" }
            ]}
          />
          <BoltInput
            label="Social title"
            value={seo.ogTitle}
            onValueChange={(ogTitle) => setSeo({ ogTitle })}
          />
          <BoltInput
            label="Social description"
            value={seo.ogDescription}
            onValueChange={(ogDescription) => setSeo({ ogDescription })}
          />
          <BoltInput
            label="Social image URL"
            value={seo.ogImage}
            onValueChange={(ogImage) => setSeo({ ogImage })}
            isInvalid={Boolean(urlError("ogImage"))}
            errorMessage={urlError("ogImage")}
          />
          <SectionTitle>Appearance</SectionTitle>
          <SelectField
            compact
            label="Theme"
            value={doc.settings.themeId ?? ""}
            onValueChange={(themeId) => updateSettings({ themeId: themeId || null })}
            options={[
              { value: "", label: themeLabel },
              ...themes.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name }))
            ]}
          />
          <SectionTitle>Version history</SectionTitle>
          <VersionLimit />
          <SectionTitle>Language</SectionTitle>
          <SelectField
            compact
            label="Page language"
            value={doc.settings.locale}
            onValueChange={(locale) => updateSettings({ locale })}
            options={
              LOCALES.some((l) => l.value === doc.settings.locale)
                ? LOCALES
                : [{ value: doc.settings.locale, label: doc.settings.locale }, ...LOCALES]
            }
          />
          <div>
            <ActionButton
              tone="ghost"
              size="sm"
              isLoading={duplicating}
              onPress={() => void duplicate()}
            >
              Duplicate page
            </ActionButton>
          </div>
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
          {pages.length > 1 ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-small text-default-600">Delete this page for good?</span>
                <ActionButton tone="danger" size="sm" onPress={() => void remove()}>
                  Delete page
                </ActionButton>
                <ActionButton tone="ghost" size="sm" onPress={() => setConfirmDelete(false)}>
                  Keep
                </ActionButton>
              </div>
            ) : (
              <div>
                <ActionButton tone="danger-ghost" size="sm" onPress={() => setConfirmDelete(true)}>
                  Delete page
                </ActionButton>
              </div>
            )
          ) : null}
        </ModalBody>
        <ModalFooter>
          <ActionButton onPress={onClose}>Done</ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
