"use client";

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@heroui/react";
import { TEMPLATE_TYPE_LABELS, createPageInputSchema } from "@nextomic/schema";
import { useState } from "react";
import { createPageAction, listPagesAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { NewTemplateModal } from "./library/new-template-modal";
import { openPage, openTemplate } from "./open-item";
import { useEditorStore } from "./store/editor-store";
import type { PageSummary } from "@/server/pages";
import type { TemplateSummary } from "@/server/templates";

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/${slug}`;
}

export function PageMenu({
  pages,
  templates,
  onPagesChange,
  onTemplatesChange
}: {
  pages: PageSummary[];
  templates: TemplateSummary[];
  onPagesChange: (pages: PageSummary[]) => void;
  onTemplatesChange: () => void;
}) {
  const pageId = useEditorStore((s) => s.page?.id);
  const name = useEditorStore((s) => s.doc?.name ?? "Page");
  const [newOpen, setNewOpen] = useState(false);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-full border border-default-200 px-4 text-small text-foreground transition-colors duration-300 hover:border-default-400"
          >
            <span className="max-w-[140px] truncate">{name}</span>
            <Icon name="ph:caret-down" width={14} height={14} />
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Pages"
          selectionMode="single"
          selectedKeys={pageId ? [pageId] : []}
          onAction={async (key) => {
            const id = String(key);
            const isTemplate = templates.some((t) => t.id === id);
            setMessage(await (isTemplate ? openTemplate(id) : openPage(id)));
          }}
        >
          <DropdownSection title="Pages" showDivider>
            {pages.map((page) => (
              <DropdownItem key={page.id} description={page.route} textValue={page.name}>
                {page.name}
              </DropdownItem>
            ))}
          </DropdownSection>
          <DropdownSection title="Templates">
            {templates.length === 0 ? (
              <DropdownItem key="no-templates" isDisabled textValue="No templates yet">
                No templates yet
              </DropdownItem>
            ) : (
              templates.map((t) => (
                <DropdownItem
                  key={t.id}
                  description={TEMPLATE_TYPE_LABELS[t.type]}
                  textValue={t.name}
                >
                  {t.name}
                </DropdownItem>
              ))
            )}
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>
      <Dropdown>
        <DropdownTrigger>
          <button
            type="button"
            aria-label="New page or template"
            className="rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
          >
            <Icon name="ph:plus" width={20} height={20} />
          </button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Create"
          onAction={(key) => (key === "page" ? setNewOpen(true) : setNewTemplateOpen(true))}
        >
          <DropdownItem key="page">New page</DropdownItem>
          <DropdownItem key="template">New template</DropdownItem>
        </DropdownMenu>
      </Dropdown>
      {message ? (
        <span role="alert" className="text-tiny text-danger">
          {message}
        </span>
      ) : null}
      {newTemplateOpen ? (
        <NewTemplateModal
          projectId={useEditorStore.getState().projectId}
          onClose={() => setNewTemplateOpen(false)}
          onCreated={async (id) => {
            onTemplatesChange();
            setMessage(await openTemplate(id));
          }}
        />
      ) : null}
      {newOpen ? (
        <NewPageModal
          onClose={() => setNewOpen(false)}
          onCreated={async (id) => {
            const list = await listPagesAction(useEditorStore.getState().projectId);
            if (list.error === null) onPagesChange(list.data);
            setMessage(await openPage(id));
          }}
        />
      ) : null}
    </>
  );
}

export function NewPageModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (pageId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [route, setRoute] = useState("");
  const [touchedRoute, setTouchedRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const input = { name, route: route.startsWith("/") ? route : `/${route}` };
    const parsed = createPageInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the name and route.");
      return;
    }
    setSaving(true);
    const result = await createPageAction(useEditorStore.getState().projectId, parsed.data);
    setSaving(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    await onCreated(result.data.id);
    onClose();
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} backdrop="blur">
      <ModalContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ModalHeader>New page</ModalHeader>
          <ModalBody className="gap-5">
            <FormInput
              label="Name"
              autoFocus
              isRequired
              value={name}
              onValueChange={(value) => {
                setName(value);
                if (!touchedRoute) setRoute(value.trim() ? slugify(value) : "");
              }}
            />
            <FormInput
              label="Route"
              placeholder="/about"
              value={route}
              onValueChange={(value) => {
                setTouchedRoute(true);
                setRoute(value);
              }}
              isInvalid={Boolean(error)}
              errorMessage={error ?? undefined}
            />
          </ModalBody>
          <ModalFooter>
            <ActionButton tone="ghost" onPress={onClose}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" isLoading={saving}>
              Create page
            </ActionButton>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
