"use client";

import { CLASS_NAME_PATTERN, parseStyleCss, styleMapToCss, type StyleMap } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { CssCodeEditor, CssCodeView } from "@/components/ui/code-editor";
import { useEditorStore } from "../../store/editor-store";
import { UNCATEGORIZED, type ClassRow } from "./class-model";

const EMPTY: StyleMap = { breakpoints: {} };

export function validClassName(name: string): string | null {
  return CLASS_NAME_PATTERN.test(name) && name.length <= 64
    ? null
    : "Use letters, digits, - and _, not starting with a digit.";
}

/**
 * The edit column of the class manager: the class's CSS (base styles and your breakpoints), then
 * rename, lock, duplicate, delete, category and use on the selected element.
 */
export function ClassEditPanel({
  row,
  categories,
  frameworkRules,
  onRename,
  onDuplicate,
  onDelete,
  onLock,
  onCategory
}: {
  row: ClassRow;
  categories: string[];
  /** The framework's CSS for this class, when it is a framework class. */
  frameworkRules: string;
  onRename: (to: string) => string | null;
  onDuplicate: () => void;
  onDelete: () => void;
  onLock: () => void;
  onCategory: (category: string | null) => void;
}) {
  const styles = useEditorStore((s) => s.project.classes[row.name]);
  const breakpoints = useEditorStore((s) => s.project.breakpoints);
  const selectedId = useEditorStore((s) => s.selectedId);
  const [css, setCss] = useState(() => styleMapToCss(styles ?? EMPTY, `.${row.name}`, breakpoints));
  const [cssError, setCssError] = useState<string | null>(null);
  const [name, setName] = useState(row.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const framework = row.source === "framework";

  function editCss(next: string) {
    setCss(next);
    const parsed = parseStyleCss(next, `.${row.name}`, breakpoints);
    if (!parsed.ok)
      return setCssError(`${parsed.line ? `Line ${parsed.line}: ` : ""}${parsed.error}`);
    setCssError(null);
    const store = useEditorStore.getState();
    store.patchProject({ classes: { ...store.project.classes, [row.name]: parsed.styles } });
  }

  function rename() {
    const to = name.trim().replace(/^\./, "");
    const failed = validClassName(to) ?? (to === row.name ? null : onRename(to));
    setNameError(failed);
    if (failed) setName(row.name);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="flex flex-col gap-2">
        <h4 className="flex items-center gap-2 text-small font-semibold">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
          {framework ? "Framework CSS" : "Custom CSS"}
        </h4>
        {framework ? (
          <CssCodeView
            label={`Framework CSS of .${row.name}`}
            value={frameworkRules || "/* No rules found. */"}
          />
        ) : row.locked ? (
          <CssCodeView label={`CSS of .${row.name}`} value={css || "/* No styles yet. */"} />
        ) : (
          <CssCodeEditor
            label={`CSS of .${row.name}`}
            value={css}
            invalid={cssError !== null}
            placeholder={`.${row.name} {\n  \n}`}
            onChange={editCss}
          />
        )}
        {cssError ? (
          <p role="alert" className="text-tiny text-danger">
            {cssError}
          </p>
        ) : (
          <p className="text-tiny text-default-500">
            {framework
              ? "This class comes from the theme framework and cannot be edited here."
              : row.locked
                ? "This class is locked. Unlock it to edit."
                : `Write the styles of .${row.name}. Media queries match your breakpoints; they are saved as the class's styles.`}
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          size="sm"
          isDisabled={selectedId === null}
          onPress={() =>
            selectedId && useEditorStore.getState().setElementClass(selectedId, row.name)
          }
        >
          {selectedId ? "Add to selected element" : "Select an element to add"}
        </ActionButton>
        {!framework ? (
          <>
            <ActionButton
              size="sm"
              tone="ghost"
              className="border border-default-200"
              onPress={onLock}
            >
              {row.locked ? "Unlock" : "Lock"}
            </ActionButton>
            <ActionButton
              size="sm"
              tone="ghost"
              className="border border-default-200"
              isDisabled={!row.hasStyles}
              onPress={onDuplicate}
            >
              Duplicate
            </ActionButton>
            <ActionButton size="sm" tone="danger-ghost" isDisabled={row.locked} onPress={onDelete}>
              Delete
            </ActionButton>
          </>
        ) : null}
      </div>

      {!framework ? (
        <section className="flex flex-col gap-3 rounded-large border border-divider p-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <FormInput
                compact
                label="Name"
                value={name}
                isDisabled={row.locked}
                onValueChange={setName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename();
                }}
              />
            </div>
            <ActionButton
              size="sm"
              tone="ghost"
              className="border border-default-200"
              isDisabled={row.locked || name.trim() === row.name}
              onPress={rename}
            >
              Rename
            </ActionButton>
          </div>
          {nameError ? (
            <p role="alert" className="text-tiny text-danger">
              {nameError}
            </p>
          ) : null}
          <SelectField
            compact
            label="Category"
            value={row.category ?? UNCATEGORIZED}
            options={[
              { value: UNCATEGORIZED, label: "Uncategorized" },
              ...categories.map((c) => ({ value: c, label: c }))
            ]}
            onValueChange={(c) => onCategory(c === UNCATEGORIZED ? null : c)}
          />
          <p className="text-tiny text-default-500">
            Used by {row.used} element{row.used === 1 ? "" : "s"}. Renames and deletes also update
            your other saved pages when you save.
          </p>
        </section>
      ) : null}
    </div>
  );
}
