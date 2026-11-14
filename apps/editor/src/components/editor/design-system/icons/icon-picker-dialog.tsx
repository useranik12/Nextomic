"use client";

import { iconFontClass, iconFontFamily, type IconLibrary } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/lib/icons/Icon";
import { useIconPicker, type IconRef, type IconTile } from "./use-icon-picker";

function TileGlyph({ tile, large }: { tile: IconTile; large?: boolean }) {
  const box = large ? "h-10 text-4xl [&>svg]:h-9" : "h-8 text-2xl [&>svg]:h-6";
  const base = `flex items-center justify-center text-foreground [&>svg]:w-auto [&>svg]:max-w-10 ${box}`;
  if (tile.font) {
    return (
      <span aria-hidden className={base}>
        <i
          className={`${iconFontFamily(tile.library)} ${iconFontClass(tile.library, tile.name)}`}
        />
      </span>
    );
  }
  return <span aria-hidden className={base} dangerouslySetInnerHTML={{ __html: tile.svg ?? "" }} />;
}

function TabPill({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      className={
        "shrink-0 rounded-full px-3 py-1 text-sm transition-colors duration-300 " +
        (active ? "bg-default-hover text-foreground" : "text-body hover:bg-default")
      }
    >
      {label}
    </button>
  );
}

/**
 * Choose an icon from the project's icon libraries: search, library tabs, recent and favorites.
 * The picker only shows enabled libraries; an icon already in use keeps drawing when its library
 * is turned off.
 */
export function IconPickerDialog({
  projectId,
  libraries,
  value,
  onPick,
  onClose
}: {
  projectId: string;
  libraries: readonly IconLibrary[];
  value: IconRef | null;
  onPick: (ref: IconRef) => void;
  onClose: () => void;
}) {
  const picker = useIconPicker(projectId, libraries);
  const [chosen, setChosen] = useState<IconRef | null>(value);
  const tile = picker.tiles.find((t) => t.library === chosen?.library && t.name === chosen?.name);

  const use = (ref: IconRef) => {
    picker.remember(ref);
    onPick(ref);
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      size="lg"
      title="Choose an icon"
      description="Search the icon libraries of this project."
      footer={
        <>
          <div className="mr-auto flex min-w-0 items-center gap-2">
            {chosen && tile ? (
              <>
                <TileGlyph tile={tile} large />
                <div className="min-w-0 text-xs">
                  <p className="truncate text-sm text-foreground">{chosen.name}</p>
                  <p className="truncate text-muted">{chosen.library}</p>
                </div>
                <button
                  type="button"
                  aria-label={
                    picker.isFavorite(chosen) ? "Remove from favorites" : "Add to favorites"
                  }
                  aria-pressed={picker.isFavorite(chosen)}
                  data-tip="Favorite"
                  onClick={() => picker.toggleFavorite(chosen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-default hover:text-foreground"
                >
                  {picker.isFavorite(chosen) ? (
                    <Icon name="ph:star-fill" width={16} height={16} />
                  ) : (
                    <Icon name="ph:star" width={16} height={16} />
                  )}
                </button>
              </>
            ) : null}
          </div>
          <ActionButton tone="secondary" size="md" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            tone="primary"
            size="md"
            isDisabled={!chosen}
            onPress={() => chosen && use(chosen)}
          >
            Use icon
          </ActionButton>
        </>
      }
    >
      <style>{picker.css}</style>
      <FormInput
        compact
        autoFocus
        isClearable
        aria-label="Search icons"
        placeholder="Search icons..."
        value={picker.query}
        onValueChange={picker.setQuery}
      />
      <div
        role="group"
        aria-label="Icon libraries"
        className="-mt-1 flex gap-1 overflow-x-auto pb-1"
      >
        <TabPill
          label="Recent"
          active={picker.tab === "recent"}
          onPress={() => picker.setTab("recent")}
        />
        <TabPill
          label="Favorites"
          active={picker.tab === "favorites"}
          onPress={() => picker.setTab("favorites")}
        />
        <TabPill label="All" active={picker.tab === ""} onPress={() => picker.setTab("")} />
        {picker.enabled.map((l) => (
          <TabPill
            key={l.key}
            label={l.name}
            active={picker.tab === l.key}
            onPress={() => picker.setTab(l.key)}
          />
        ))}
      </div>
      <div
        role="region"
        aria-label="Icons"
        aria-busy={picker.busy}
        className="h-72 overflow-y-auto rounded-2xl border border-border p-2"
      >
        {picker.error ? (
          <p role="alert" className="p-2 text-xs text-danger">
            {picker.error}
          </p>
        ) : picker.tiles.length === 0 ? (
          <p className="p-2 text-sm text-muted">
            {picker.busy
              ? "Searching..."
              : picker.enabled.length === 0
                ? "No icon library is turned on. Install one in Design System > Fonts & Icons."
                : picker.tab === "recent"
                  ? "Icons you use show up here."
                  : picker.tab === "favorites"
                    ? "Star an icon to keep it here."
                    : "No icons match."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,2.75rem)] gap-1">
              {picker.tiles.map((t) => {
                const on = chosen?.library === t.library && chosen.name === t.name;
                return (
                  <button
                    key={`${t.library}/${t.name}`}
                    type="button"
                    aria-label={`${t.name}, ${t.library}`}
                    aria-pressed={on}
                    data-tip={t.name}
                    onClick={() => setChosen({ library: t.library, name: t.name })}
                    onDoubleClick={() => use({ library: t.library, name: t.name })}
                    className={
                      "flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 " +
                      (on ? "bg-default-hover ring-1 ring-focus" : "hover:bg-default")
                    }
                  >
                    <TileGlyph tile={t} />
                  </button>
                );
              })}
            </div>
            {picker.hasMore ? (
              <div className="flex justify-center pt-2">
                <ActionButton
                  tone="secondary"
                  size="sm"
                  isLoading={picker.busy}
                  onPress={picker.loadMore}
                >
                  Show more
                </ActionButton>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}
