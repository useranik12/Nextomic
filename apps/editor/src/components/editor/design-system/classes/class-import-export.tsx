"use client";

import { exportClassesCss, importClassesCss } from "@nextomic/schema";
import { useRef, useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { useEditorStore } from "../../store/editor-store";

const MAX_BYTES = 2_000_000;

/** Export every project class as a CSS file, or import the simple class rules of a CSS file. */
export function ClassImportExport() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function exportCss() {
    const { project, projectId } = useEditorStore.getState();
    const css = exportClassesCss(project.classes, project.breakpoints);
    if (css === "") return setMessage({ text: "No class has styles to export.", error: true });
    const url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nextomic-classes-${projectId}.css`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: "Classes exported.", error: false });
  }

  async function importFile(file: File) {
    if (file.size > MAX_BYTES) {
      return setMessage({ text: "The file is larger than 2 MB.", error: true });
    }
    const store = useEditorStore.getState();
    const result = importClassesCss(await file.text(), store.project.breakpoints);
    if (!result.ok) return setMessage({ text: result.error, error: true });
    const fresh = Object.entries(result.classes).filter(([name]) => !store.project.classes[name]);
    const existing = Object.keys(result.classes).length - fresh.length;
    if (fresh.length > 0) {
      store.patchProject({
        classes: { ...store.project.classes, ...Object.fromEntries(fresh) }
      });
    }
    setMessage({
      text: `Imported ${fresh.length} class${fresh.length === 1 ? "" : "es"}. Skipped ${existing} that already exist and ${result.skipped} rule${result.skipped === 1 ? "" : "s"} it cannot read.`,
      error: false
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <ActionButton size="sm" tone="ghost" onPress={exportCss}>
          Export CSS
        </ActionButton>
        <ActionButton size="sm" tone="ghost" onPress={() => input.current?.click()}>
          Import CSS
        </ActionButton>
        <input
          ref={input}
          type="file"
          accept=".css,text/css"
          aria-label="Import classes from a CSS file"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
      </div>
      {message ? (
        <p
          role={message.error ? "alert" : "status"}
          className={"text-xs " + (message.error ? "text-danger" : "text-muted")}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
