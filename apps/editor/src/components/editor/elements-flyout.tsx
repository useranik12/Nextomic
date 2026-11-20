"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  listElementDefinitions,
  type ElementCategory,
  type ElementDefinition
} from "@nextomic/renderer";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { NEW_PREFIX, useDragActive } from "./dnd";
import { ElementIcon } from "./icons";
import { useEditorStore } from "./store/editor-store";

const GROUPS: { id: ElementCategory; label: string }[] = [
  { id: "layout", label: "Layout" },
  { id: "basic", label: "Basic" },
  { id: "forms", label: "Forms" }
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
        "flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-default text-sm text-body outline-none transition-colors duration-300 hover:bg-default-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-focus/30 " +
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
  // Every group starts open; a closed group keeps its place in the list.
  const [closed, setClosed] = useState<ReadonlySet<ElementCategory>>(new Set());
  const allClosed = closed.size === GROUPS.length;
  const toggleGroup = (id: ElementCategory) =>
    setClosed((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Hidden (not unmounted) while a tile is dragged, so the canvas is clear and the drag survives.
  const dragging = useDragActive();
  const insert = useEditorStore((s) => s.insertElement);
  const panel = useRef<HTMLDivElement>(null);
  // A click anywhere outside closes it (the + button toggles it itself); so does a click in the
  // canvas, which is another document and so only moves the focus.
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || panel.current?.contains(target) || target.closest("[data-elements-toggle]"))
        return;
      onClose();
    };
    const canvasFocus = () => {
      if (document.activeElement instanceof HTMLIFrameElement) onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("blur", canvasFocus);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("blur", canvasFocus);
    };
  }, [onClose]);
  const definitions = useMemo(
    () =>
      listElementDefinitions().filter(
        (d) => !d.hidden && d.label.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query]
  );

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Elements"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      className={
        "absolute left-full top-3 ml-2 z-30 flex max-h-[calc(100%-24px)] w-[304px] flex-col rounded-2xl bg-surface p-4 shadow-xl transition-opacity duration-150" +
        (dragging ? " pointer-events-none opacity-0" : "")
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Elements</h2>
        <button
          type="button"
          aria-label={allClosed ? "Open all groups" : "Shrink all groups"}
          title={allClosed ? "Open all groups" : "Shrink all groups"}
          onClick={() => setClosed(allClosed ? new Set() : new Set(GROUPS.map((g) => g.id)))}
          className="relative h-8 w-8 rounded-xl text-body transition-colors duration-300 hover:bg-default hover:text-foreground"
        >
          <Icon
            name="ph:arrows-in-line-vertical"
            width={16}
            height={16}
            className={
              "absolute inset-0 m-auto transition-all duration-300 " +
              (allClosed ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")
            }
          />
          <Icon
            name="ph:arrows-out-line-vertical"
            width={16}
            height={16}
            className={
              "absolute inset-0 m-auto transition-all duration-300 " +
              (allClosed ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")
            }
          />
        </button>
      </div>
      <div className="relative mb-3">
        <Icon
          name="ph:magnifying-glass"
          width={16}
          height={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search elements"
          aria-label="Search elements"
          className="h-9 w-full rounded-full border border-border bg-transparent pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle hover:border-default-400 focus:border-focus"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {definitions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No elements match.</p>
        ) : (
          GROUPS.map((group) => {
            const items = definitions.filter((d) => d.category === group.id);
            if (items.length === 0) return null;
            // A search shows every match, even in a group that is shrunk.
            const open = query.trim() !== "" || !closed.has(group.id);
            return (
              <section key={group.id} className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center gap-1.5 rounded-lg py-0.5 text-left outline-none transition-colors duration-300 hover:text-accent focus-visible:ring-1 focus-visible:ring-focus/30"
                  >
                    <Icon
                      name="ph:caret-right"
                      width={12}
                      height={12}
                      className={"transition-transform duration-300 " + (open ? "rotate-90" : "")}
                    />
                    {group.label}
                  </button>
                </h3>
                {open ? (
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
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
