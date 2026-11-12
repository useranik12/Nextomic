"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import {
  BASE_BREAKPOINT_ID,
  BREAKPOINT_ICONS,
  DEFAULT_BREAKPOINTS,
  MAX_BREAKPOINTS,
  breakpointListSchema,
  sortBreakpoints,
  type BreakpointDef,
  type BreakpointKind
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { saveProjectSettingsAction } from "@/app/(builder)/editor/[id]/actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { breakpointHasStyles, useEditorStore } from "./store/editor-store";

const KIND_OPTIONS = [
  { value: "down", label: "And below (max-width)" },
  { value: "up", label: "And above (min-width)" }
];
const ICON_OPTIONS = BREAKPOINT_ICONS.map((icon) => ({
  value: icon,
  label: icon.charAt(0).toUpperCase() + icon.slice(1)
}));

function uniqueId(list: BreakpointDef[]): string {
  let n = list.length;
  while (list.some((b) => b.id === `bp${n}`)) n += 1;
  return `bp${n}`;
}

export function BreakpointManager({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const project = useEditorStore((s) => s.project);
  const doc = useEditorStore((s) => s.doc);
  const [draft, setDraft] = useState<BreakpointDef[]>(sortBreakpoints(project.breakpoints));
  const [removed, setRemoved] = useState<BreakpointDef[]>([]);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const removedWithStyles = useMemo(
    () => removed.filter((b) => breakpointHasStyles(doc, b.id)),
    [removed, doc]
  );

  function patch(index: number, change: Partial<BreakpointDef>) {
    setDraft((list) => list.map((b, i) => (i === index ? { ...b, ...change } : b)));
  }

  function remove(index: number) {
    const target = draft[index];
    if (!target || target.id === BASE_BREAKPOINT_ID) return;
    setRemoved((list) => [...list, target]);
    setDraft((list) => list.filter((_, i) => i !== index));
  }

  /** Order is derived from width: re-sort whenever a size or kind is settled. */
  const settle = () => setDraft((list) => sortBreakpoints(list));

  function add() {
    setDraft((list) =>
      sortBreakpoints([
        ...list,
        {
          id: uniqueId(list),
          name: `Breakpoint ${list.length}`,
          icon: "tablet",
          kind: "down",
          width: 480,
          previewWidth: 480
        }
      ])
    );
  }

  function reset() {
    const defaults = DEFAULT_BREAKPOINTS.map((b) => ({ ...b }));
    const keep = new Set(defaults.map((b) => b.id));
    setRemoved((list) => [...list, ...draft.filter((b) => !keep.has(b.id))]);
    setDraft(sortBreakpoints(defaults));
  }

  async function save() {
    const parsed = breakpointListSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid breakpoints.");
      return;
    }
    const nextSettings = { ...project, breakpoints: sortBreakpoints(parsed.data) };
    setSaving(true);
    const result = await saveProjectSettingsAction(
      useEditorStore.getState().projectId,
      nextSettings
    );
    setSaving(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    const styleMoves: Record<string, string | null> = {};
    for (const b of removedWithStyles) {
      const to = moves[b.id];
      styleMoves[b.id] = to && to !== "discard" ? to : null;
    }
    useEditorStore.getState().setBreakpoints(result.data.breakpoints, styleMoves);
    setError(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>Breakpoints</ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-muted">
            Desktop is the base. Breakpoints order themselves by width, larger screens on the left.
            Canvas width is only used while editing.
          </p>
          <ul className="flex flex-col gap-3">
            {draft.map((bp, index) => {
              const isBase = bp.id === BASE_BREAKPOINT_ID;
              return (
                <li
                  key={bp.id}
                  className="grid grid-cols-[1fr_1fr] gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[1.2fr_1fr_1.4fr_0.8fr_0.8fr_auto]"
                >
                  <FormInput
                    compact
                    label="Name"
                    value={bp.name}
                    onValueChange={(name) => patch(index, { name })}
                  />
                  <SelectField
                    compact
                    label="Icon"
                    value={bp.icon}
                    options={ICON_OPTIONS}
                    onValueChange={(icon) => patch(index, { icon: icon as BreakpointDef["icon"] })}
                  />
                  {isBase ? (
                    <FormInput compact label="Kind" value="Base (all sizes)" isReadOnly />
                  ) : (
                    <SelectField
                      compact
                      label="Kind"
                      value={bp.kind}
                      options={KIND_OPTIONS}
                      onValueChange={(kind) => {
                        patch(index, { kind: kind as BreakpointKind });
                        queueMicrotask(settle);
                      }}
                    />
                  )}
                  <FormInput
                    compact
                    label="Width (px)"
                    type="number"
                    isDisabled={isBase}
                    value={bp.width === null ? "" : String(bp.width)}
                    onValueChange={(v) => patch(index, { width: v === "" ? null : Number(v) })}
                    onBlur={settle}
                  />
                  <FormInput
                    compact
                    label="Canvas (px)"
                    type="number"
                    value={bp.previewWidth === undefined ? "" : String(bp.previewWidth)}
                    onValueChange={(v) => {
                      const next: Partial<BreakpointDef> = {};
                      if (v !== "") next.previewWidth = Number(v);
                      patch(index, v === "" ? { previewWidth: undefined } : next);
                    }}
                  />
                  <div className="flex items-end gap-1">
                    <button
                      type="button"
                      aria-label={`Delete ${bp.name}`}
                      disabled={isBase}
                      onClick={() => remove(index)}
                      className="rounded p-1.5 text-muted hover:text-danger disabled:opacity-30"
                    >
                      <Icon name="ph:trash" width={16} height={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {removedWithStyles.map((bp) => (
            <SelectField
              key={bp.id}
              compact
              label={`"${bp.name}" has styles. What should happen to them?`}
              value={moves[bp.id] ?? "discard"}
              options={[
                { value: "discard", label: "Discard them" },
                ...draft.map((b) => ({ value: b.id, label: `Move to ${b.name}` }))
              ]}
              onValueChange={(to) => setMoves((m) => ({ ...m, [bp.id]: to }))}
            />
          ))}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter className="justify-between">
          <div className="flex gap-2">
            <ActionButton tone="ghost" onPress={add} isDisabled={draft.length >= MAX_BREAKPOINTS}>
              Add breakpoint
            </ActionButton>
            <ActionButton tone="ghost" onPress={reset}>
              Reset to defaults
            </ActionButton>
          </div>
          <div className="flex gap-2">
            <ActionButton tone="ghost" onPress={onClose}>
              Cancel
            </ActionButton>
            <ActionButton onPress={() => void save()} isLoading={saving}>
              Save
            </ActionButton>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
