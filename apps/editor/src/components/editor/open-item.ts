import { defaultPageSettings } from "@nextomic/schema";
import { loadPageAction } from "@/app/(builder)/editor/[id]/actions";
import { loadTemplateAction } from "@/app/(builder)/editor/[id]/library-actions";
import { useEditorStore } from "./store/editor-store";

/** True when the open page or template may be left (saved, or the user agrees to drop the edits). */
function mayLeave(what: string): boolean | "conflict" {
  const store = useEditorStore.getState();
  if (store.saveStatus === "conflict") return "conflict";
  return !(
    (store.saveStatus === "dirty" || store.saveStatus === "error") &&
    !window.confirm(`This ${what} has unsaved changes. Switch anyway and discard them?`)
  );
}

function leaveWhat(): string {
  return useEditorStore.getState().page?.kind === "template" ? "template" : "page";
}

/** Opens a page on the canvas. Returns an error message, or null. */
export async function openPage(pageId: string): Promise<string | null> {
  const allowed = mayLeave(leaveWhat());
  if (allowed === "conflict") return "Resolve the save conflict first.";
  if (!allowed) return null;
  const result = await loadPageAction(useEditorStore.getState().projectId, pageId);
  if (result.error !== null) return result.error;
  const page = result.data;
  useEditorStore
    .getState()
    .loadPage(
      { id: page.id, version: page.version, kind: "page" },
      { name: page.name, route: page.route, settings: page.settings, tree: page.tree }
    );
  return null;
}

/** Opens a template on the same canvas. Returns an error message, or null. */
export async function openTemplate(templateId: string): Promise<string | null> {
  const allowed = mayLeave(leaveWhat());
  if (allowed === "conflict") return "Resolve the save conflict first.";
  if (!allowed) return null;
  const result = await loadTemplateAction(useEditorStore.getState().projectId, templateId);
  if (result.error !== null) return result.error;
  const t = result.data;
  useEditorStore.getState().loadPage(
    { id: t.id, version: t.version, kind: "template", templateType: t.type },
    {
      name: t.name,
      route: "",
      // Templates have no route, parameters or state; the page settings are only a placeholder.
      settings: defaultPageSettings(),
      tree: t.tree,
      template: t.settings
    }
  );
  return null;
}
