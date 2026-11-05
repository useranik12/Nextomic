import type { DropZone } from "../dnd";

// Where a drag currently points inside the canvas iframe. The canvas frame writes it while the
// pointer is over the canvas; the drag provider reads it on drop. Null when the pointer is elsewhere.
export interface CanvasDropTarget {
  id: string;
  zone: DropZone;
}

let current: CanvasDropTarget | null = null;

export function setCanvasDropTarget(target: CanvasDropTarget | null): void {
  current = target;
}

export function getCanvasDropTarget(): CanvasDropTarget | null {
  return current;
}
