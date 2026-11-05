"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  listElementDefinitions,
  type ElementCategory,
  type ElementDefinition
} from "@nextomic/renderer";
import { useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { NEW_PREFIX, useDragActive } from "./dnd";
import { ElementIcon } from "./icons";
import { useEditorStore } from "./store/editor-store";

const GROUPS: { id: ElementCategory; label: string }[] = [
  { id: "layout", label: "Layout" },
  { id: "basic", label: "Basic" }
];

function Tile({ definition, onInsert }: { definition: ElementDefinition; onInsert: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${NEW_PREFIX}${definition.type}`
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onInsert}
      className={
        "flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-large bg-default-100 text-small text-default-600 outline-none transition-colors duration-300 hover:bg-default-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-default-800 " +
        (isDragging ? "opacity-40" : "")
      }
      {...attributes}
      {...listeners}
    >
      <ElementIcon type={definition.type} />
      {definition.label}
    </button>
  );
}

export function ElementsFlyout({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  // Hidden (not unmounted) while a tile is dragged, so the canvas is clear and the drag survives.
  const dragging = useDragActive();
  const insert = useEditorStore((s) => s.insertElement);
  const definitions = useMemo(
    () =>
      listElementDefinitions().filter(
        (d) => !d.hidden && d.label.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query]
  );

  return (
    <div
      role="dialog"
      aria-label="Elements"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      className={
        "absolute left-full top-3 ml-2 z-30 flex max-h-[calc(100%-24px)] w-[304px] flex-col rounded-large bg-content1 p-4 shadow-xl transition-opacity duration-150" +
        (dragging ? " pointer-events-none opacity-0" : "")
      }
    >
      <div className="relative mb-3">
        <Icon
          name="ph:magnifying-glass"
          width={16}
          height={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-default-500"
        />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search elements"
          aria-label="Search elements"
          className="h-9 w-full rounded-full border-2 border-default-200 bg-transparent pl-9 pr-3 text-small text-foreground outline-none transition-colors placeholder:text-default-400 hover:border-default-400 focus:border-default-800"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {definitions.length === 0 ? (
          <p className="py-6 text-center text-small text-default-500">No elements match.</p>
        ) : (
          GROUPS.map((group) => {
            const items = definitions.filter((d) => d.category === group.id);
            if (items.length === 0) return null;
            return (
              <section key={group.id} className="mb-4">
                <h3 className="mb-2 text-small font-semibold text-foreground">{group.label}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {items.map((definition) => (
                    <Tile
                      key={definition.type}
                      definition={definition}
                      onInsert={() => {
                        insert(definition.type);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
