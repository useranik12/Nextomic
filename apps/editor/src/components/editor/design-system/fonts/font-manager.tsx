"use client";

import {
  FONT_FAMILY_PATTERN,
  SYSTEM_FONT_STACKS,
  fontSchema,
  slugifyFontId,
  type ProjectFont
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { AddGoogleFont } from "./add-google-font";
import { categoryCounts, filterFonts, previewWeight, type FontCategoryId } from "./font-model";

const SAMPLE = "The quick brown fox jumps over the lazy dog";

const CATEGORIES: { id: FontCategoryId; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "custom", label: "Custom fonts" },
  { id: "google", label: "Google fonts" },
  { id: "standard", label: "Standard fonts" }
];

type AddMode = "google" | "custom";

const KINDS = [
  { value: "sans-serif", label: "Sans serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "display", label: "Display" },
  { value: "handwriting", label: "Handwriting" },
  { value: "other", label: "Other" }
];

/** Asks for the name of a custom font; its faces are added in the font editor next. */
function NewCustomFont({
  fonts,
  onCreate
}: {
  fonts: readonly ProjectFont[];
  onCreate: (font: ProjectFont) => Promise<void>;
}) {
  const [family, setFamily] = useState("");
  const [category, setCategory] = useState("sans-serif");
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const name = family.trim();
    if (!FONT_FAMILY_PATTERN.test(name) || name.length > 64)
      return setError("Use letters, digits, spaces and - _ . + only (up to 64 characters).");
    const id = slugifyFontId(name);
    if (fonts.some((f) => f.id === id || f.family.toLowerCase() === name.toLowerCase()))
      return setError("A font with that name exists.");
    const parsed = fontSchema.safeParse({
      id,
      family: name,
      source: "upload",
      sourceNote: "Custom",
      category,
      files: [],
      rights: false
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid font.");
    setError(null);
    await onCreate(parsed.data);
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <h4 className="text-small font-semibold">Add a custom font</h4>
      <p className="text-tiny text-default-500">
        Name the font first. This is the name you pick it by in the Design tab. You add its faces
        (weights and styles) on the next screen.
      </p>
      <FormInput
        compact
        autoFocus
        label="Font name"
        placeholder="for example Satoshi"
        value={family}
        onValueChange={setFamily}
      />
      <SelectField
        compact
        label="Kind of font"
        options={KINDS}
        value={category}
        onValueChange={setCategory}
      />
      {error ? (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <ActionButton size="sm" type="submit" isDisabled={family.trim() === ""}>
          <Icon name="ph:plus" width={14} height={14} />
          Create font
        </ActionButton>
      </div>
    </form>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-default-200 px-2 py-0.5 text-tiny text-default-700">
      {children}
    </span>
  );
}

/**
 * The font manager: a header with search and add, categories on the left, one card per font.
 * A font is a group of faces that share a name; the card opens the font editor.
 */
export function FontManager({
  fonts,
  onOpen,
  onAdded,
  onToggleFavorite
}: {
  fonts: ProjectFont[];
  onOpen: (font: ProjectFont) => void;
  onAdded: (font: ProjectFont) => Promise<void>;
  onToggleFavorite: (font: ProjectFont) => void;
}) {
  const [category, setCategory] = useState<FontCategoryId>(
    fonts.length === 0 ? "google" : "custom"
  );
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<AddMode | null>(null);
  const counts = useMemo(() => categoryCounts(fonts), [fonts]);
  const visible = useMemo(() => filterFonts(fonts, category, query), [fonts, category, query]);
  const standard = useMemo(
    () =>
      SYSTEM_FONT_STACKS.filter((s) => s.label.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );
  const count = (id: FontCategoryId): number =>
    id === "standard" ? SYSTEM_FONT_STACKS.length : counts[id];

  async function installed(font: ProjectFont) {
    await onAdded(font);
    setAdding(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-divider p-4">
        <h3 className="text-medium font-semibold">Font manager</h3>
        <div className="relative ml-auto w-64">
          <Icon
            name="ph:magnifying-glass"
            width={16}
            height={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-default-500"
          />
          <input
            type="search"
            aria-label="Search fonts"
            placeholder="Search fonts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-medium border border-default-200 bg-transparent pl-9 pr-3 text-small outline-none focus:border-default-800"
          />
        </div>
        <div role="group" aria-label="Add a font" className="flex gap-1">
          <ActionButton
            size="sm"
            tone={adding === "google" ? "primary" : "ghost"}
            className="border border-default-200"
            onPress={() => setAdding(adding === "google" ? null : "google")}
          >
            Google font
          </ActionButton>
          <ActionButton
            size="sm"
            tone={adding === "custom" ? "primary" : "ghost"}
            className="border border-default-200"
            onPress={() => setAdding(adding === "custom" ? null : "custom")}
          >
            <Icon name="ph:plus" width={14} height={14} />
            Custom font
          </ActionButton>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Font categories"
          className="flex w-52 shrink-0 flex-col gap-1 border-r border-divider p-3"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={category === c.id && adding === null}
              onClick={() => {
                setCategory(c.id);
                setAdding(null);
              }}
              className={
                "flex items-center justify-between rounded-medium px-3 py-2 text-small transition-colors duration-300 " +
                (category === c.id && adding === null
                  ? "bg-default-200 font-medium"
                  : "text-default-600 hover:bg-default-100")
              }
            >
              <span>{c.label}</span>
              <span className="text-tiny text-default-500">{count(c.id)}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto">
          {adding === "google" ? <AddGoogleFont installed={fonts} onInstalled={installed} /> : null}
          {adding === "custom" ? <NewCustomFont fonts={fonts} onCreate={installed} /> : null}
          {adding === null && category === "standard" ? (
            <ul aria-label="Standard fonts" className="flex flex-col gap-2 p-4">
              {standard.length === 0 ? (
                <li className="text-small text-default-500">No standard font matches.</li>
              ) : null}
              {standard.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center gap-3 rounded-large bg-default-100 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-small font-medium">{s.label}</p>
                    <p style={{ fontFamily: s.value }} className="truncate text-medium">
                      {SAMPLE}
                    </p>
                  </div>
                  <Chip>System</Chip>
                </li>
              ))}
            </ul>
          ) : null}
          {adding === null && category !== "standard" ? (
            visible.length === 0 ? (
              <div className="flex flex-col items-start gap-2 p-6 text-small text-default-500">
                <p>
                  {query
                    ? "No font matches your search."
                    : category === "favorites"
                      ? "No favorites yet. Open a font and tap the heart."
                      : "No fonts here yet."}
                </p>
                {!query && category !== "favorites" ? (
                  <ActionButton
                    size="sm"
                    onPress={() => setAdding(category === "google" ? "google" : "custom")}
                  >
                    {category === "google" ? "Add a Google font" : "Add a custom font"}
                  </ActionButton>
                ) : null}
              </div>
            ) : (
              <ul aria-label="Fonts" className="flex flex-col gap-2 p-4">
                {visible.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2 rounded-large bg-default-100 pr-3 transition-colors duration-300 hover:bg-default-200"
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(f)}
                      className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-small font-medium">{f.family}</span>
                        <Chip>{f.source === "google" ? "Google" : "Custom"}</Chip>
                        {f.active ? null : <Chip>Off</Chip>}
                        {f.rights ? null : <Chip>Rights not confirmed</Chip>}
                        <span className="text-tiny text-default-500">Styles: {f.files.length}</span>
                      </span>
                      <span
                        style={{
                          fontFamily: `"${f.family}", sans-serif`,
                          fontWeight: previewWeight(f)
                        }}
                        className="truncate text-medium"
                      >
                        {SAMPLE}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={
                        f.favorite
                          ? `Remove ${f.family} from favorites`
                          : `Add ${f.family} to favorites`
                      }
                      aria-pressed={f.favorite}
                      onClick={() => onToggleFavorite(f)}
                      className={
                        "rounded-full p-2 hover:bg-default-300/40 " +
                        (f.favorite ? "text-danger" : "text-default-600")
                      }
                    >
                      {f.favorite ? (
                        <Icon name="ph:heart-fill" width={18} height={18} />
                      ) : (
                        <Icon name="ph:heart" width={18} height={18} />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
