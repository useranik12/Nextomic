"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { getElementDefinition } from "@nextomic/renderer";
import { findNode } from "@nextomic/schema";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getCanvasDropTarget } from "./canvas/canvas-drop";
import { useEditorStore } from "./store/editor-store";

export type DropZone = "before" | "inside" | "after";
export interface DropTarget {
  id: string;
  zone: DropZone;
}

export const NEW_PREFIX = "new:";
export const ROOT_END_ID = "__root_end";

const DropTargetContext = createContext<DropTarget | null>(null);
export const useDropTarget = () => useContext(DropTargetContext);

const DragActiveContext = createContext(false);
/** True while any element is being dragged (the canvas shields its iframe during a drag). */
export const useDragActive = () => useContext(DragActiveContext);

function zoneFor(pointerY: number, top: number, height: number, canNest: boolean): DropZone {
  const ratio = (pointerY - top) / Math.max(height, 1);
  if (canNest) return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
  return ratio < 0.5 ? "before" : "after";
}

function pointerY(event: DragMoveEvent | DragEndEvent): number | null {
  const rect = event.active.rect.current.translated;
  return rect ? rect.top + rect.height / 2 : null;
}

/** One DndContext for the whole editor: tree rows reorder, Elements tiles insert. */
export function EditorDndProvider({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const resolve = useCallback((event: DragMoveEvent | DragEndEvent): DropTarget | null => {
    const over = event.over;
    const y = pointerY(event);
    if (!over || y === null) return null;
    if (over.id === ROOT_END_ID) return { id: ROOT_END_ID, zone: "inside" };
    const doc = useEditorStore.getState().doc;
    const found = doc ? findNode(doc.tree, String(over.id)) : null;
    if (!found) return null;
    const canNest = getElementDefinition(found.node.type)?.canHaveChildren ?? false;
    return { id: found.node.id, zone: zoneFor(y, over.rect.top, over.rect.height, canNest) };
  }, []);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setDragActive(true);
    const id = String(event.active.id);
    if (id.startsWith(NEW_PREFIX)) {
      setOverlay(getElementDefinition(id.slice(NEW_PREFIX.length))?.label ?? "Element");
      return;
    }
    const doc = useEditorStore.getState().doc;
    setOverlay((doc && findNode(doc.tree, id)?.node.name) ?? "Element");
  }, []);

  const onDragMove = useCallback(
    (event: DragMoveEvent) =>
      // Over the canvas the page itself shows the drop marker, so the tree shows none.
      setDropTarget(getCanvasDropTarget() ? null : resolve(event)),
    [resolve]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const target = getCanvasDropTarget() ?? resolve(event);
      setDropTarget(null);
      setOverlay(null);
      setDragActive(false);
      const store = useEditorStore.getState();
      if (!target || !store.doc) return;
      const activeId = String(event.active.id);
      const root = store.doc.tree;
      let parentId = root.id;
      let index = root.children.length;
      if (target.id !== ROOT_END_ID) {
        const found = findNode(root, target.id);
        if (!found) return;
        if (target.zone === "inside") {
          parentId = found.node.id;
          index = found.node.children.length;
        } else if (found.parent) {
          parentId = found.parent.id;
          index = found.index + (target.zone === "after" ? 1 : 0);
        }
      }
      if (activeId.startsWith(NEW_PREFIX))
        store.insertElement(activeId.slice(NEW_PREFIX.length), parentId, index);
      else store.moveElement(activeId, parentId, index);
    },
    [resolve]
  );

  const cancel = useCallback(() => {
    setDropTarget(null);
    setOverlay(null);
    setDragActive(false);
  }, []);

  const value = useMemo(() => dropTarget, [dropTarget]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={cancel}
    >
      <DragActiveContext.Provider value={dragActive}>
        <DropTargetContext.Provider value={value}>{children}</DropTargetContext.Provider>
      </DragActiveContext.Provider>
      <DragOverlay dropAnimation={null} style={{ pointerEvents: "none" }}>
        {overlay ? (
          <div className="rounded-medium bg-default-800 px-3 py-1.5 text-small font-medium text-default-50 shadow-lg">
            {overlay}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
