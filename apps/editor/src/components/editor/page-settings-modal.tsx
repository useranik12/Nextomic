"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch } from "@heroui/react";
import { pageNameSchema, pageSeoSchema } from "@nextomic/schema";
import { useState } from "react";
import {
  deletePageAction,
  duplicatePageAction,
  listPagesAction
} from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { openPage } from "./page-menu";
import { useEditorStore } from "./store/editor-store";
import type { PageSummary } from "@/server/pages";

// General, SEO and Language. Appearance, Templates, Rendering and Custom code appear as the
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
    const openError = await openPage(result.data.id, saveNow);
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
      if (next) await openPage(next.id, saveNow);
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
        <ModalBody className="gap-5">
          <SectionTitle>General</SectionTitle>
          <FormInput
            label="Name"
            value={doc.name}
            onValueChange={(name) => updateMeta({ name })}
            isInvalid={!nameValid}
            errorMessage={nameValid ? undefined : "A page needs a name."}
          />
          <FormInput
            label="Internal description"
            value={doc.settings.description}
            onValueChange={(description) => updateSettings({ description })}
          />
          <Switch
            isSelected={doc.settings.includeInPublish}
            onValueChange={(includeInPublish) => updateSettings({ includeInPublish })}
          >
            Include in publish
          </Switch>
          <Switch
            isSelected={doc.settings.isHome}
            onValueChange={(isHome) => updateSettings({ isHome })}
          >
            Home page
          </Switch>
          <SectionTitle>SEO</SectionTitle>
          <FormInput
            label="SEO title"
            value={seo.title}
            onValueChange={(title) => setSeo({ title })}
            isInvalid={seo.title.length > 120}
            errorMessage={seo.title.length > 120 ? "Keep it under 120 characters." : undefined}
          />
          <FormInput
            label="Meta description"
            value={seo.description}
            onValueChange={(description) => setSeo({ description })}
            isInvalid={seo.description.length > 300}
            errorMessage={
              seo.description.length > 300 ? "Keep it under 300 characters." : undefined
            }
          />
          <FormInput
            label="Canonical URL"
            placeholder="https://example.com/page"
            value={seo.canonical}
            onValueChange={(canonical) => setSeo({ canonical })}
            isInvalid={Boolean(urlError("canonical"))}
            errorMessage={urlError("canonical")}
          />
          <SelectField
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
          <FormInput
            label="Social title"
            value={seo.ogTitle}
            onValueChange={(ogTitle) => setSeo({ ogTitle })}
          />
          <FormInput
            label="Social description"
            value={seo.ogDescription}
            onValueChange={(ogDescription) => setSeo({ ogDescription })}
          />
          <FormInput
            label="Social image URL"
            value={seo.ogImage}
            onValueChange={(ogImage) => setSeo({ ogImage })}
            isInvalid={Boolean(urlError("ogImage"))}
            errorMessage={urlError("ogImage")}
          />
          <SectionTitle>Language</SectionTitle>
          <SelectField
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
