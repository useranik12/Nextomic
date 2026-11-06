"use client";

import { newTheme, themeListSchema, uniqueThemeSlug, type Theme } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import type { PageSummary } from "@/server/pages";
import { useEditorStore } from "../store/editor-store";
import { ThemeConditions } from "./theme-conditions";
import { ThemeVariables } from "./theme-variables";

function conditionSummary(theme: Theme): string {
  if (theme.isDefault) return "Applies everywhere by default";
  const n = theme.conditions.items.length;
  return n === 0 ? "Only pages that choose it" : `${n} rule${n === 1 ? "" : "s"}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-small font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Themes: named style sets. The first theme created is the default and applies everywhere until a
 * page forces another or another theme's conditions match.
 */
export function ThemesTab({ pages }: { pages: readonly PageSummary[] }) {
  const themes = useEditorStore((s) => s.project.themes);
  const variables = useEditorStore((s) => s.project.variables);
  const setThemes = useEditorStore((s) => s.setThemes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = themes.find((t) => t.id === selectedId) ?? themes[0] ?? null;

  function commit(next: Theme[]) {
    const parsed = themeListSchema.safeParse(next);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid theme.");
    setError(null);
    setThemes(parsed.data);
  }
  const patch = (id: string, change: Partial<Theme>) =>
    commit(themes.map((t) => (t.id === id ? { ...t, ...change } : t)));

  function create() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the theme a name.");
    const theme = newTheme(crypto.randomUUID(), trimmed, themes);
    commit([...themes, theme]);
    setSelectedId(theme.id);
    setName("");
  }

  function duplicate(theme: Theme) {
    const copyName = `${theme.name} copy`.slice(0, 64);
    const copy: Theme = {
      ...structuredClone(theme),
      id: crypto.randomUUID(),
      name: copyName,
      slug: uniqueThemeSlug(copyName, themes),
      isDefault: false
    };
    commit([...themes, copy]);
    setSelectedId(copy.id);
  }

  function remove(theme: Theme) {
    if (!window.confirm(`Delete theme "${theme.name}"? Pages that chose it fall back to Auto.`))
      return;
    const rest = themes.filter((t) => t.id !== theme.id);
    const first = rest[0];
    commit(
      theme.isDefault && first
        ? rest.map((t) => (t === first ? { ...t, isDefault: true } : t))
        : rest
    );
    setSelectedId(null);
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-64 shrink-0 flex-col border-r border-divider">
        <div className="flex flex-col gap-2 border-b border-divider p-3">
          <FormInput
            compact
            aria-label="New theme name"
            placeholder="New theme name"
            value={name}
            onValueChange={setName}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
          />
          <ActionButton size="sm" onPress={create}>
            New theme
          </ActionButton>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {themes.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-current={selected?.id === t.id}
                onClick={() => setSelectedId(t.id)}
                className={
                  "flex w-full flex-col rounded-medium px-3 py-2 text-left transition-colors duration-300 " +
                  (selected?.id === t.id ? "bg-default-200" : "hover:bg-default-100")
                }
              >
                <span className="flex items-center gap-2 text-small font-medium">
                  <span className="truncate">{t.name}</span>
                  {t.isDefault ? (
                    <span className="rounded-full bg-default-800 px-2 text-tiny text-default-50">
                      Default
                    </span>
                  ) : null}
                </span>
                <span className="text-tiny text-default-500">{conditionSummary(t)}</span>
              </button>
            </li>
          ))}
          {themes.length === 0 ? (
            <li className="p-2 text-small text-default-500">
              No themes yet. The first one you create applies to every page and template.
            </li>
          ) : null}
        </ul>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <p role="alert" className="pb-2 text-tiny text-danger">
            {error}
          </p>
        ) : null}
        {selected ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-medium font-medium">{selected.name}</h2>
              <div className="flex gap-1">
                <ActionButton size="sm" tone="ghost" onPress={() => duplicate(selected)}>
                  <Icon name="ph:copy" width={14} height={14} />
                  Duplicate
                </ActionButton>
                <ActionButton size="sm" tone="danger-ghost" onPress={() => remove(selected)}>
                  <Icon name="ph:trash" width={14} height={14} />
                  Delete
                </ActionButton>
              </div>
            </div>
            <Section title="General">
              <FormInput
                compact
                label="Name"
                value={selected.name}
                onValueChange={(v) => patch(selected.id, { name: v })}
              />
              <p className="text-tiny text-default-500">
                Used in CSS as <code>[data-nxt-theme=&quot;{selected.slug}&quot;]</code>
              </p>
              <SelectField
                compact
                label="Default color mode"
                value={selected.defaultMode}
                onValueChange={(v) => patch(selected.id, { defaultMode: v })}
                options={selected.modes.map((m) => ({ value: m.id, label: m.name }))}
              />
              <label className="flex items-center gap-2 text-small">
                <input
                  type="checkbox"
                  checked={selected.respectSystemPreference}
                  onChange={(e) =>
                    patch(selected.id, { respectSystemPreference: e.target.checked })
                  }
                />
                Follow the visitor&apos;s system light/dark preference
              </label>
              {selected.isDefault ? null : (
                <>
                  <FormInput
                    compact
                    type="number"
                    label="Priority (higher wins when several themes match)"
                    value={String(selected.priority)}
                    onValueChange={(v) =>
                      patch(selected.id, { priority: Math.max(0, Math.round(Number(v) || 0)) })
                    }
                  />
                  <div>
                    <ActionButton
                      size="sm"
                      tone="ghost"
                      onPress={() =>
                        commit(themes.map((t) => ({ ...t, isDefault: t.id === selected.id })))
                      }
                    >
                      Make default
                    </ActionButton>
                  </div>
                </>
              )}
            </Section>
            <Section title="Variables">
              <ThemeVariables
                theme={selected}
                variables={variables}
                onChange={(next) => patch(selected.id, { variables: next })}
              />
            </Section>
            <Section title="Conditions">
              <ThemeConditions
                theme={selected}
                pages={pages}
                onChange={(conditions) => patch(selected.id, { conditions })}
              />
            </Section>
          </div>
        ) : (
          <p className="text-small text-default-500">
            Themes style the whole site with their own variable values and light/dark modes. Create
            one on the left.
          </p>
        )}
      </div>
    </div>
  );
}
