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
import { createPageInputSchema } from "@nextomic/schema";
import { useState } from "react";
import {
  createPageAction,
  listPagesAction,
  loadPageAction
} from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "./store/editor-store";
import type { PageSummary } from "@/server/pages";

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/${slug}`;
}

export async function openPage(pageId: string): Promise<string | null> {
  const store = useEditorStore.getState();
  if (store.saveStatus === "conflict") return "Resolve the save conflict first.";
  if (
    (store.saveStatus === "dirty" || store.saveStatus === "error") &&
    !window.confirm("This page has unsaved changes. Switch anyway and discard them?")
  )
    return null;
  const result = await loadPageAction(store.projectId, pageId);
  if (result.error !== null) return result.error;
  const page = result.data;
  useEditorStore
    .getState()
    .loadPage(
      { id: page.id, version: page.version },
      { name: page.name, route: page.route, settings: page.settings, tree: page.tree }
    );
  return null;
}

export function PageMenu({
  pages,
  onPagesChange
}: {
  pages: PageSummary[];
  onPagesChange: (pages: PageSummary[]) => void;
}) {
  const pageId = useEditorStore((s) => s.page?.id);
  const name = useEditorStore((s) => s.doc?.name ?? "Page");
  const [newOpen, setNewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-full border-2 border-default-200 px-4 text-small text-foreground transition-colors duration-300 hover:border-default-400"
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
            const error = await openPage(String(key));
            setMessage(error);
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
            <DropdownItem key="no-templates" isDisabled textValue="No templates yet">
              No templates yet
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>
      <button
        type="button"
        aria-label="New page"
        onClick={() => setNewOpen(true)}
        className="rounded-full p-2 text-default-600 transition-colors duration-300 hover:bg-default-100 hover:text-foreground"
      >
        <Icon name="ph:plus" width={20} height={20} />
      </button>
      {message ? (
        <span role="alert" className="text-tiny text-danger">
          {message}
        </span>
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

function NewPageModal({
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
