"use client";

import { Modal, ModalContent } from "@heroui/react";
import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import type { PageSummary } from "@/server/pages";
import { ClassesTab } from "./classes/classes-tab";
import { ColorsTab } from "./colors/colors-tab";
import { DesignNavProvider, type DesignNavParams } from "./design-nav";
import { CssFilesTab } from "./css-files-tab";
import { DESIGN_TABS, isDesignTab, type DesignTabId } from "./design-tabs";
import { FontsTab } from "./fonts/fonts-tab";
import { FrameworkTab } from "./framework-tab";
import { SpacingTab } from "./scales/spacing-tab";
import { TypographyTab } from "./scales/typography-tab";
import { ThemesTab } from "./themes-tab";
import { useDesignDraft } from "./use-design-draft";
import { VariablesTab } from "./variables/variables-tab";

/**
 * The Design System page: a large modal over the editor. Every tab edits a draft: changes show in
 * the canvas at once but are written only with Save (top right). Closing with unsaved changes asks
 * whether to save, discard or keep editing.
 */
export function DesignSystemModal({
  initialTab,
  onClose,
  saveNow,
  pages
}: {
  initialTab?: string;
  onClose: () => void;
  saveNow: () => Promise<void>;
  pages: PageSummary[];
}) {
  const [tab, setTab] = useState<DesignTabId>(isDesignTab(initialTab) ? initialTab : "variables");
  const [params, setParams] = useState<DesignNavParams>({});
  const [asking, setAsking] = useState(false);
  const draft = useDesignDraft(saveNow);
  // Tabs never save on their own: Save in this header is the only way changes are written.
  const deferSave = useCallback(async () => undefined, []);

  const navKey = JSON.stringify(params);

  const requestClose = useCallback(() => {
    if (draft.dirty) setAsking(true);
    else onClose();
  }, [draft.dirty, onClose]);

  async function saveAndClose() {
    if (await draft.save()) onClose();
  }

  const go = useCallback((next: DesignTabId, nextParams: DesignNavParams = {}) => {
    setParams(nextParams);
    setTab(next);
  }, []);

  return (
    <Modal
      isOpen
      onClose={requestClose}
      isDismissable={false}
      hideCloseButton
      size="5xl"
      scrollBehavior="inside"
      classNames={{ base: "h-[80vh] max-h-[80vh]", body: "p-0" }}
    >
      <ModalContent>
        <DesignNavProvider value={{ go, params }}>
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-divider px-4">
            <h2 className="flex items-center gap-2 text-medium font-medium">
              <Icon name="ph:palette" width={20} height={20} />
              Design System
            </h2>
            <div className="flex items-center gap-2">
              {draft.error ? (
                <span
                  role="alert"
                  className="max-w-sm truncate text-tiny text-danger"
                  title={draft.error}
                >
                  {draft.error}
                </span>
              ) : draft.dirty ? (
                <span className="text-tiny font-medium text-warning">Unsaved changes</span>
              ) : null}
              <ActionButton
                size="sm"
                isDisabled={!draft.dirty}
                isLoading={draft.saving}
                onPress={() => void draft.save()}
              >
                Save
              </ActionButton>
              <button
                type="button"
                aria-label="Close the Design System"
                onClick={requestClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-default-600 transition-colors duration-300 hover:bg-default-100"
              >
                <Icon name="ph:x" width={16} height={16} />
              </button>
            </div>
          </header>
          <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-b-large">
            <nav
              aria-label="Design system"
              className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-divider p-3"
            >
              {DESIGN_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={tab === t.id}
                  onClick={() => go(t.id)}
                  className={
                    "flex flex-col rounded-medium px-3 py-2 text-left transition-colors duration-300 " +
                    (tab === t.id
                      ? "bg-default-200 text-foreground"
                      : "text-default-600 hover:bg-default-100")
                  }
                >
                  <span className="text-small font-medium">{t.label}</span>
                  <span className="text-tiny text-default-500">{t.hint}</span>
                </button>
              ))}
            </nav>
            <div className="min-w-0 flex-1">
              {tab === "themes" ? <ThemesTab pages={pages} /> : null}
              {tab === "framework" ? <FrameworkTab /> : null}
              {tab === "colors" ? <ColorsTab /> : null}
              {tab === "typography" ? <TypographyTab /> : null}
              {tab === "spacing" ? <SpacingTab /> : null}
              {tab === "variables" ? <VariablesTab key={navKey} /> : null}
              {tab === "classes" ? <ClassesTab key={navKey} /> : null}
              {tab === "css" ? <CssFilesTab pages={pages} /> : null}
              {tab === "fonts" ? <FontsTab saveNow={deferSave} /> : null}
            </div>
            {asking ? (
              <div
                role="alertdialog"
                aria-label="Unsaved changes"
                className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm"
              >
                <div className="flex w-96 flex-col gap-3 rounded-large border border-divider bg-content1 p-5 shadow-xl">
                  <h3 className="text-medium font-semibold">Save your changes?</h3>
                  <p className="text-small text-default-600">
                    You changed the Design System. Unsaved changes are lost when you close it.
                  </p>
                  <div className="flex justify-end gap-2">
                    <ActionButton size="sm" tone="ghost" onPress={() => setAsking(false)}>
                      Keep editing
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      tone="danger-ghost"
                      onPress={() => {
                        draft.discard();
                        onClose();
                      }}
                    >
                      Discard
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      isLoading={draft.saving}
                      onPress={() => void saveAndClose()}
                    >
                      Save and close
                    </ActionButton>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </DesignNavProvider>
      </ModalContent>
    </Modal>
  );
}
