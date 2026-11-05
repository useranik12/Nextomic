import { CanvasDocument } from "@/components/editor/canvas/canvas-document";

export const metadata = { title: "Canvas", robots: { index: false } };

// Loaded only inside the editor's sandboxed iframe. It receives its content through postMessage
// and never reads project data or cookies.
export default function CanvasPage() {
  return <CanvasDocument />;
}
