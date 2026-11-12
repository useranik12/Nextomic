"use client";

import { CssCodeEditor } from "@/components/ui/code-editor";
import { importFrameworkCss, type Framework, type ImportReport } from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";

/** Import any CSS framework file (a Core Framework export, a hand-written sheet) into the theme. */
export function ImportFramework({
  onImport,
  onCancel
}: {
  onImport: (fw: Framework) => string | null;
  onCancel: () => void;
}) {
  const [name, setName] = useState("Imported framework");
  const [css, setCss] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (file.size > 2_000_000) return setError("The file is larger than 2 MB.");
    setError(null);
    setReport(null);
    setCss(await file.text());
    setName(file.name.replace(/\.css$/i, "") || "Imported framework");
  }

  function apply() {
    const result = importFrameworkCss(css, name);
    if ("error" in result) return setError(result.error);
    const failed = onImport(result.framework);
    if (failed) return setError(failed);
    setReport(result.report);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-default-300 px-4 py-6 text-center focus-within:ring-1 focus-within:ring-focus/30 hover:border-default-500">
        <span className="text-sm font-medium">Choose a .css file</span>
        <span className="text-xs text-muted">
          or paste the CSS below. Up to 2 MB. This replaces the theme framework.
        </span>
        <input
          type="file"
          accept=".css,text/css"
          className="sr-only"
          aria-label="CSS framework file"
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <FormInput compact label="Framework name" value={name} onValueChange={setName} />
      <CssCodeEditor label="CSS" value={css} onChange={setCss} />
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {report ? (
        <div role="status" className="rounded-2xl bg-default p-3 text-xs">
          Imported {report.variables} variables ({report.darkVariables} with dark values),{" "}
          {report.classes} classes
          {report.scales.length > 0 ? `, scales: ${report.scales.join(", ")}` : ""}.
          {report.warnings.map((w) => (
            <p key={w} className="text-warning-600">
              {w}
            </p>
          ))}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <ActionButton size="sm" tone="ghost" onPress={onCancel}>
          {report ? "Done" : "Cancel"}
        </ActionButton>
        <ActionButton size="sm" isDisabled={css.trim() === ""} onPress={apply}>
          Import into theme
        </ActionButton>
      </div>
    </div>
  );
}
