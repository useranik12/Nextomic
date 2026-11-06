"use client";

import {
  countFamilyInStyles,
  fontStack,
  mentionsFamily,
  type ProjectFont,
  type ProjectVariable
} from "@nextomic/schema";
import { useMemo, useRef } from "react";
import { InfoTip } from "@/components/ui/info-tip";
import { useEditorStore } from "../../store/editor-store";
import { useDesignNav } from "../design-nav";
import type { FontUse } from "./use-font-usage";

const ROLES = [
  { name: "font-heading", label: "Heading" },
  { name: "font-body", label: "Body" },
  { name: "font-mono", label: "Mono" }
] as const;

/**
 * "Use as a font variable": a chip sets `--nxt-font-*` to this font and a second click undoes it
 * (the variable goes back to what it was, or is removed). Like every Design System change it is
 * a draft until Save. Below, the classes that use this font, with a link to the class manager.
 */
export function FontRoles({ font, use }: { font: ProjectFont; use: FontUse }) {
  const variables = useEditorStore((s) => s.project.variables);
  const classes = useEditorStore((s) => s.project.classes);
  const nav = useDesignNav();
  // What each variable was before this font took it, so un-clicking restores it.
  const before = useRef(new Map<string, ProjectVariable | null>());
  const classNames = useMemo(
    () =>
      Object.entries(classes)
        .filter(([, styles]) => countFamilyInStyles(styles, font.family) > 0)
        .map(([n]) => n),
    [classes, font.family]
  );

  const isSet = (name: string): boolean => {
    const v = variables.find((x) => x.name === name);
    return v ? mentionsFamily(v.value, font.family) : false;
  };

  function toggle(name: string) {
    const store = useEditorStore.getState();
    if (isSet(name)) {
      const previous = before.current.get(name);
      if (previous) store.upsertVariables([previous]);
      else store.deleteVariable(name);
      before.current.delete(name);
      return;
    }
    if (!before.current.has(name))
      before.current.set(name, variables.find((x) => x.name === name) ?? null);
    store.upsertVariables([
      { name, type: "font-family", group: "Typography", value: fontStack(font) }
    ]);
  }

  return (
    <section aria-label="Use as" className="flex flex-col gap-2">
      <h4 className="flex items-center gap-1.5 text-small font-medium">
        Use as a font variable
        <InfoTip text="A font variable such as --nxt-font-heading holds a font name. Set it to this font and any text that uses the variable switches to it, so you can change a site font in one place." />
      </h4>
      <p className="text-tiny text-default-500">
        Sets <code>--nxt-font-*</code> to this font. Click again to undo. Nothing is kept until you
        save.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {ROLES.map((r) => {
          const on = isSet(r.name);
          return (
            <button
              key={r.name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(r.name)}
              className={
                "h-8 rounded-full px-4 text-small font-medium transition-colors duration-300 focus-visible:ring-1 focus-visible:ring-default-800/40 " +
                (on
                  ? "bg-default-800 text-default-50"
                  : "border border-default-200 text-default-700 hover:bg-default-100")
              }
            >
              {on ? `${r.label} ✓` : `Set as ${r.label}`}
            </button>
          );
        })}
      </div>
      <p className="text-tiny text-default-600" role="status">
        {classNames.length === 0 ? (
          "No classes use this font yet."
        ) : (
          <>
            {classNames.length} class{classNames.length === 1 ? "" : "es"} use
            {classNames.length === 1 ? "s" : ""} this font
            {use.elements > 0
              ? `, ${use.elements} element${use.elements === 1 ? "" : "s"} directly`
              : ""}
            .{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() =>
                nav.go("classes", { classNames, classLabel: `Classes that use ${font.family}` })
              }
            >
              Show classes
            </button>
          </>
        )}
      </p>
    </section>
  );
}
