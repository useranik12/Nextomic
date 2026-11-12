"use client";

import {
  exportFrameworkCss,
  frameworkStylesheet,
  mainFramework,
  mainTheme,
  themeListSchema,
  type Framework
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";
import { FrameworkClasses } from "./framework/framework-classes";
import { FrameworkVariables } from "./framework/framework-variables";
import { ImportFramework } from "./framework/import-framework";
import { useFramework } from "./framework/use-framework";

type View = "variables" | "classes" | "import";
const VIEWS: { id: View; label: string }[] = [
  { id: "variables", label: "Variables" },
  { id: "classes", label: "Classes" },
  { id: "import", label: "Import" }
];

function download(fw: Framework, siteUid: string) {
  const blob = new Blob([exportFrameworkCss(fw, frameworkStylesheet(fw))], { type: "text/css" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nextomic-framework-${siteUid}-${fw.version}.css`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Design System > Framework: the CSS framework each theme runs on (variables, scales, classes). */
export function FrameworkTab() {
  const { themes, theme, framework, setSelectedId, setFramework } = useFramework();
  const siteUid = useEditorStore((s) => s.projectId);
  const [view, setView] = useState<View>("variables");
  const [error, setError] = useState<string | null>(null);

  function run(next: Framework | null): string | null {
    const failed = setFramework(next);
    setError(failed);
    return failed;
  }

  if (!theme) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-muted">
          This project has no theme yet. The Main theme runs on the Main framework: modern colors,
          fluid scales and utility classes.
        </p>
        <ActionButton
          size="sm"
          onPress={() => {
            const parsed = themeListSchema.safeParse([mainTheme()]);
            if (parsed.success) useEditorStore.getState().setThemes(parsed.data);
          }}
        >
          Create the Main theme
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-3">
        <div className="w-48">
          <SelectField
            compact
            label="Theme"
            value={theme.id}
            options={themes.map((t) => ({ value: t.id, label: t.name }))}
            onValueChange={setSelectedId}
          />
        </div>
        <div
          className="flex flex-1 flex-wrap items-center gap-1"
          role="group"
          aria-label="Framework views"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={
                "rounded-full px-3 py-1 text-sm transition-colors duration-300 " +
                (view === v.id ? "bg-default-hover text-foreground" : "text-body hover:bg-default")
              }
            >
              {v.label}
            </button>
          ))}
        </div>
        {framework ? (
          <>
            <ActionButton
              size="sm"
              tone="ghost"
              onPress={() => {
                download(framework, siteUid);
                void setFramework({ ...framework, version: framework.version + 1 });
              }}
            >
              Export CSS
            </ActionButton>
            <ActionButton
              size="sm"
              tone="danger-ghost"
              onPress={() => {
                if (window.confirm(`Remove "${framework.name}" from "${theme.name}"?`)) run(null);
              }}
            >
              Remove
            </ActionButton>
          </>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="px-3 pt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "import" ? (
          <ImportFramework onImport={run} onCancel={() => setView("variables")} />
        ) : !framework ? (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-sm text-muted">
              {theme.name} has no framework. Start from the Main framework or import your own.
            </p>
            <div className="flex gap-2">
              <ActionButton size="sm" onPress={() => run(mainFramework())}>
                Use the Main framework
              </ActionButton>
              <ActionButton size="sm" tone="ghost" onPress={() => setView("import")}>
                Import CSS
              </ActionButton>
            </div>
          </div>
        ) : view === "variables" ? (
          <FrameworkVariables
            darkMode={theme?.darkMode ?? false}
            framework={framework}
            onChange={run}
          />
        ) : (
          <FrameworkClasses framework={framework} />
        )}
      </div>
    </div>
  );
}
