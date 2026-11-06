"use client";

import {
  mainFramework,
  mainTheme,
  themeListSchema,
  type Framework,
  type Theme
} from "@nextomic/schema";
import type { ReactNode } from "react";
import { useState } from "react";
import { ActionButton, SelectField } from "@/components/ui/controls";
import { useEditorStore } from "../../store/editor-store";
import { useFramework } from "./use-framework";

export interface GateProps {
  theme: Theme;
  framework: Framework;
  /** Replaces the theme's framework. Returns an error message, or null when it was applied. */
  update: (next: Framework) => string | null;
}

/**
 * Colors, Typography and Spacing all edit the framework of one theme. The gate picks the theme,
 * handles themes that have no framework yet, and shows the error of a rejected change.
 */
export function FrameworkGate({
  children,
  title
}: {
  title: string;
  children: (props: GateProps) => ReactNode;
}) {
  const { themes, theme, framework, setSelectedId, setFramework } = useFramework();
  const [error, setError] = useState<string | null>(null);

  if (!theme) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <h2 className="text-medium font-semibold">{title}</h2>
        <p className="text-small text-default-500">
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
  if (!framework) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <h2 className="text-medium font-semibold">{title}</h2>
        <p className="text-small text-default-500">
          {theme.name} has no framework. Start from the Main framework, or import your own in the
          Framework tab.
        </p>
        <ActionButton size="sm" onPress={() => setFramework(mainFramework())}>
          Use the Main framework
        </ActionButton>
      </div>
    );
  }
  const update = (next: Framework): string | null => {
    const failed = setFramework(next);
    setError(failed);
    return failed;
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-divider p-3">
        <h2 className="mr-auto text-medium font-semibold">{title}</h2>
        {themes.length > 1 ? (
          <div className="w-48">
            <SelectField
              compact
              label="Theme"
              value={theme.id}
              options={themes.map((t) => ({ value: t.id, label: t.name }))}
              onValueChange={setSelectedId}
            />
          </div>
        ) : (
          <span className="pb-1.5 text-tiny text-default-500">Theme: {theme.name}</span>
        )}
      </div>
      {error ? (
        <p role="alert" className="px-3 pt-2 text-tiny text-danger">
          {error}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children({ theme, framework, update })}</div>
    </div>
  );
}
