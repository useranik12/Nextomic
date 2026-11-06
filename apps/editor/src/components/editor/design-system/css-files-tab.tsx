"use client";

import { CSS_FILE_MAX_COUNT, cssFileSchema, validateCssFile, type CssFile } from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { CssCodeEditor } from "@/components/ui/code-editor";
import { SwitchRow } from "@/components/ui/switch-row";
import { Icon } from "@/lib/icons/Icon";
import type { PageSummary } from "@/server/pages";
import { useEditorStore } from "../store/editor-store";

function nextName(files: readonly CssFile[]): string {
  for (let n = files.length + 1; ; n += 1) {
    const name = `styles-${n}.css`;
    if (!files.some((f) => f.name === name)) return name;
  }
}

/**
 * Custom CSS files: written after the theme and before classes, in the order shown. A file can be
 * switched off, limited to some pages and minified on the published site. A file with a syntax
 * error is skipped (and marked here) so it can never break a page.
 */
export function CssFilesTab({ pages }: { pages: readonly PageSummary[] }) {
  const files = useEditorStore((s) => s.project.cssFiles);
  const patchProject = useEditorStore((s) => s.patchProject);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = files.find((f) => f.id === selectedId) ?? files[0] ?? null;
  const check = useMemo(() => (selected ? validateCssFile(selected.css) : null), [selected]);

  const commit = (next: CssFile[]) => patchProject({ cssFiles: next });
  const patch = (id: string, change: Partial<CssFile>) =>
    commit(files.map((f) => (f.id === id ? { ...f, ...change } : f)));

  function add() {
    const file = cssFileSchema.parse({ id: crypto.randomUUID(), name: nextName(files) });
    commit([...files, file]);
    setSelectedId(file.id);
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    commit(next);
  }

  function remove(file: CssFile) {
    const rest = files.filter((f) => f.id !== file.id);
    commit(rest);
    setSelectedId(rest[0]?.id ?? null);
  }

  function togglePage(file: CssFile, pageId: string) {
    const has = file.pageIds.includes(pageId);
    patch(file.id, {
      pageIds: has ? file.pageIds.filter((p) => p !== pageId) : [...file.pageIds, pageId]
    });
  }

  return (
    <div className="flex h-full min-h-0 gap-6">
      <aside className="flex w-64 shrink-0 flex-col gap-3" aria-label="CSS files">
        <ActionButton size="sm" onPress={add} isDisabled={files.length >= CSS_FILE_MAX_COUNT}>
          <Icon name="ph:plus" width={14} height={14} />
          New CSS file
        </ActionButton>
        {files.length === 0 ? (
          <p className="text-small text-default-500">
            No CSS files yet. Add one for rules that apply across the site.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {files.map((file, index) => {
              const valid = validateCssFile(file.css).ok;
              return (
                <li
                  key={file.id}
                  className={
                    "flex items-center gap-1 rounded-medium pr-1 " +
                    (file.id === selected?.id ? "bg-default-200" : "hover:bg-default-100")
                  }
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(file.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-small outline-none focus-visible:ring-2 focus-visible:ring-default-800/50"
                  >
                    <span className={"truncate " + (file.enabled ? "" : "text-default-400")}>
                      {file.name}
                    </span>
                    {valid ? null : (
                      <Icon
                        name="ph:warning"
                        width={14}
                        height={14}
                        className="shrink-0 text-danger"
                        aria-label="Has a syntax error and is skipped"
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${file.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded p-1 text-default-500 hover:text-foreground disabled:opacity-30"
                  >
                    <Icon name="ph:arrow-up" width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${file.name} down`}
                    disabled={index === files.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded p-1 text-default-500 hover:text-foreground disabled:opacity-30"
                  >
                    <Icon name="ph:arrow-down" width={14} height={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section
        className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto pr-1"
        aria-label="CSS file"
      >
        {selected ? (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-64">
                <FormInput
                  compact
                  label="File name"
                  value={selected.name}
                  onValueChange={(name) => patch(selected.id, { name })}
                />
              </div>
              <div className="w-56">
                <SelectField
                  compact
                  label="Applies to"
                  value={selected.scope}
                  options={[
                    { value: "global", label: "Every page" },
                    { value: "pages", label: "Chosen pages" }
                  ]}
                  onValueChange={(scope) =>
                    patch(selected.id, { scope: scope as CssFile["scope"] })
                  }
                />
              </div>
              <ActionButton size="sm" tone="danger-ghost" onPress={() => remove(selected)}>
                <Icon name="ph:trash" width={14} height={14} />
                Delete file
              </ActionButton>
            </div>
            <div className="flex flex-wrap gap-6">
              <SwitchRow
                label="Enabled"
                tip="Off: the file stays here but is not added to any page."
                selected={selected.enabled}
                onChange={(enabled) => patch(selected.id, { enabled })}
              />
              <SwitchRow
                label="Minify on publish"
                tip="Removes comments and extra spaces from the file in the published site. The editor and preview always use the source."
                selected={selected.minify}
                onChange={(minify) => patch(selected.id, { minify })}
              />
            </div>
            {selected.scope === "pages" ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-small font-semibold text-foreground">Pages</legend>
                {pages.length === 0 ? (
                  <p className="text-small text-default-500">This project has no pages yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pages.map((page) => {
                      const on = selected.pageIds.includes(page.id);
                      return (
                        <button
                          key={page.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => togglePage(selected, page.id)}
                          className={
                            "rounded-full px-3 py-1.5 text-small transition-colors duration-300 " +
                            (on
                              ? "bg-default-800 text-default-50"
                              : "bg-default-100 text-default-600 hover:bg-default-200")
                          }
                        >
                          {page.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <CssCodeEditor
                label={`CSS of ${selected.name}`}
                invalid={check?.ok === false}
                value={selected.css}
                placeholder={".card {\n  border-radius: 12px;\n}"}
                onChange={(css) => patch(selected.id, { css })}
              />
              {check && !check.ok ? (
                <p role="alert" className="text-tiny text-danger">
                  {check.line ? `Line ${check.line}: ` : ""}
                  {check.error} This file is skipped until it is fixed.
                </p>
              ) : (
                <p className="text-tiny text-default-500">
                  Rules here come after the theme and before classes and element styles.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-small text-default-500">Select or add a CSS file.</p>
        )}
      </section>
    </div>
  );
}
