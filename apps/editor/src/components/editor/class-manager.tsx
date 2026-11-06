"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { CLASS_NAME_PATTERN, countClassUsage } from "@nextomic/schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { classUsageAction, replaceClassAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "./store/editor-store";

const KEEP = "__remove";

function validName(name: string): string | null {
  if (!CLASS_NAME_PATTERN.test(name) || name.length > 64)
    return "Use letters, digits, - and _, not starting with a digit.";
  return null;
}

/**
 * Global class manager: every class of the project with how many elements use it. Create,
 * duplicate, rename and delete (with a replacement). Renames and deletes also update the other
 * saved pages, so no element is left pointing at a class that is gone.
 */
export function ClassManager({ saveNow }: { saveNow: () => Promise<void> }) {
  const classes = useEditorStore((s) => s.project.classes);
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const pageId = useEditorStore((s) => s.page?.id);
  const selectedId = useEditorStore((s) => s.selectedId);
  const [others, setOthers] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<{ name: string; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOthers = useCallback(async () => {
    if (!pageId) return;
    const result = await classUsageAction(useEditorStore.getState().projectId, pageId);
    if (result.error !== null) setError(result.error);
    else {
      setError(null);
      setOthers(result.data);
    }
  }, [pageId]);

  useEffect(() => {
    void loadOthers();
  }, [loadOthers]);

  const rows = useMemo(() => {
    const local = tree ? countClassUsage(tree) : {};
    const names = new Set([
      ...Object.keys(classes),
      ...Object.keys(local),
      ...Object.keys(others ?? {})
    ]);
    const q = query.trim().toLowerCase();
    return [...names]
      .filter((name) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, used: (local[name] ?? 0) + (others?.[name] ?? 0) }));
  }, [classes, tree, others, query]);

  function create() {
    const name = draft.trim().replace(/^\./, "");
    const problem = validName(name);
    if (problem) return setError(problem);
    if (!useEditorStore.getState().createClass(name)) return setError("That class already exists.");
    setError(null);
    setDraft("");
  }

  function duplicate(name: string) {
    let copy = `${name}-copy`;
    for (let n = 2; classes[copy]; n += 1) copy = `${name}-copy-${n}`;
    if (!useEditorStore.getState().duplicateClass(name, copy))
      setError("Only classes with styles can be duplicated.");
  }

  /** Other pages first (server), then the open page and project classes, then one save. */
  async function propagate(from: string, to: string | null, local: () => void) {
    if (!pageId) return;
    setBusy(true);
    const result = await replaceClassAction(useEditorStore.getState().projectId, pageId, from, to);
    if (result.error !== null) {
      setBusy(false);
      return setError(result.error);
    }
    local();
    await saveNow();
    await loadOthers();
    setBusy(false);
    setError(null);
  }

  async function rename() {
    if (!renaming) return;
    const to = renaming.text.trim().replace(/^\./, "");
    const problem = validName(to);
    if (problem) return setError(problem);
    if (to === renaming.name) return setRenaming(null);
    if (classes[to]) return setError("That class already exists.");
    await propagate(renaming.name, to, () =>
      useEditorStore.getState().renameClass(renaming.name, to)
    );
    setRenaming(null);
  }

  async function remove(name: string, replaceWith: string | null) {
    await propagate(name, replaceWith, () =>
      useEditorStore.getState().deleteClass(name, replaceWith)
    );
    setDeleting(null);
  }

  const deletingUsage = rows.find((r) => r.name === deleting)?.used ?? 0;
  const replacements = Object.keys(classes).filter((n) => n !== deleting);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b border-divider p-3">
        <h2 className="text-small font-medium">Classes</h2>
        <div className="flex gap-1.5">
          <FormInput
            compact
            aria-label="New class name"
            placeholder="New class"
            value={draft}
            onValueChange={setDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
          />
          <ActionButton size="sm" onPress={create} isDisabled={draft.trim() === ""}>
            Add
          </ActionButton>
        </div>
        <FormInput
          compact
          type="search"
          aria-label="Search classes"
          placeholder="Search classes"
          value={query}
          onValueChange={setQuery}
        />
        {error ? (
          <p role="alert" className="text-tiny text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <ul aria-label="Classes" className="min-h-0 flex-1 overflow-y-auto p-2">
        {others === null && !error ? (
          <li className="p-2 text-small text-default-500">Loading classes…</li>
        ) : rows.length === 0 ? (
          <li className="p-2 text-small text-default-500">
            {query ? "No class matches." : "No classes yet. Add one above or from an element."}
          </li>
        ) : (
          rows.map(({ name, used }) => (
            <li
              key={name}
              className="group flex h-9 items-center gap-1 rounded-medium px-2 hover:bg-default-100"
            >
              {renaming?.name === name ? (
                <input
                  autoFocus
                  aria-label={`Rename ${name}`}
                  value={renaming.text}
                  disabled={busy}
                  onChange={(e) => setRenaming({ name, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void rename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={() => setRenaming(null)}
                  className="h-7 min-w-0 flex-1 rounded-medium bg-default-100 px-2 font-mono text-small outline-none focus-visible:ring-2 focus-visible:ring-default-800/30"
                />
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate rounded-full bg-sky-500/15 px-2.5 py-0.5 font-mono text-tiny text-sky-700 dark:text-sky-300">
                    .{name}
                  </span>
                  <span
                    className="text-tiny text-default-500"
                    title={`${used} element${used === 1 ? "" : "s"} use this class`}
                  >
                    {used}
                  </span>
                  <span className="hidden items-center group-focus-within:flex group-hover:flex">
                    {selectedId ? (
                      <RowButton
                        label={`Add ${name} to the selected element`}
                        icon="ph:plus"
                        onPress={() => useEditorStore.getState().setElementClass(selectedId, name)}
                      />
                    ) : null}
                    <RowButton
                      label={`Duplicate ${name}`}
                      icon="ph:copy"
                      onPress={() => duplicate(name)}
                    />
                    <RowButton
                      label={`Rename ${name}`}
                      icon="ph:pencil-simple"
                      onPress={() => setRenaming({ name, text: name })}
                    />
                    <RowButton
                      label={`Delete ${name}`}
                      icon="ph:trash"
                      danger
                      onPress={() => setDeleting(name)}
                    />
                  </span>
                </>
              )}
            </li>
          ))
        )}
      </ul>
      {deleting ? (
        <Modal isOpen onClose={() => setDeleting(null)} backdrop="blur">
          <ModalContent>
            <ModalHeader>Delete .{deleting}</ModalHeader>
            <ModalBody>
              <p className="text-small text-default-600">
                {deletingUsage === 0
                  ? "No element uses this class. Its styles are deleted."
                  : `${deletingUsage} element${deletingUsage === 1 ? "" : "s"} use this class. Its styles are deleted; choose what the elements get instead.`}
              </p>
              {deletingUsage > 0 ? (
                <ReplaceChoice
                  options={replacements}
                  onConfirm={(to) => void remove(deleting, to)}
                  busy={busy}
                  onCancel={() => setDeleting(null)}
                />
              ) : null}
            </ModalBody>
            {deletingUsage === 0 ? (
              <ModalFooter>
                <ActionButton tone="ghost" onPress={() => setDeleting(null)}>
                  Cancel
                </ActionButton>
                <ActionButton
                  tone="danger"
                  isLoading={busy}
                  onPress={() => void remove(deleting, null)}
                >
                  Delete
                </ActionButton>
              </ModalFooter>
            ) : null}
          </ModalContent>
        </Modal>
      ) : null}
    </div>
  );
}

function ReplaceChoice({
  options,
  onConfirm,
  onCancel,
  busy
}: {
  options: string[];
  onConfirm: (to: string | null) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [choice, setChoice] = useState(KEEP);
  return (
    <div className="flex flex-col gap-3 pb-2">
      <SelectField
        label="Replace with"
        value={choice}
        onValueChange={setChoice}
        options={[
          { value: KEEP, label: "Nothing (remove it from the elements)" },
          ...options.map((name) => ({ value: name, label: `.${name}` }))
        ]}
      />
      <div className="flex justify-end gap-2">
        <ActionButton tone="ghost" onPress={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton
          tone="danger"
          isLoading={busy}
          onPress={() => onConfirm(choice === KEEP ? null : choice)}
        >
          Delete class
        </ActionButton>
      </div>
    </div>
  );
}

function RowButton({
  label,
  icon,
  onPress,
  danger
}: {
  label: string;
  icon: "ph:plus" | "ph:copy" | "ph:pencil-simple" | "ph:trash";
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onPress}
      className={`rounded p-1 text-default-500 ${danger ? "hover:text-danger" : "hover:text-foreground"}`}
    >
      {icon === "ph:plus" ? (
        <Icon name="ph:plus" width={14} height={14} />
      ) : icon === "ph:copy" ? (
        <Icon name="ph:copy" width={14} height={14} />
      ) : icon === "ph:pencil-simple" ? (
        <Icon name="ph:pencil-simple" width={14} height={14} />
      ) : (
        <Icon name="ph:trash" width={14} height={14} />
      )}
    </button>
  );
}
