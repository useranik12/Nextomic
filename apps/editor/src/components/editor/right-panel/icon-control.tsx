"use client";

import type { ControlDef } from "@nextomic/renderer";
import { dynamicTextOf, parseDynamicText, tagText, type ElementNode } from "@nextomic/schema";
import { useId, useState } from "react";
import { SelectField } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { IconPickerDialog } from "../design-system/icons/icon-picker-dialog";
import { useEditorStore } from "../store/editor-store";
import { DynamicBolt } from "./dynamic-bolt";
import { SettingRow, compactFieldClass } from "./setting-row";

/**
 * The Icon element's icon: the library (a fixed choice) and the icon name (may be dynamic), with a
 * picker that sets both. Only the name takes dynamic data: the library decides which icon sets a
 * page loads, so it must be known when the page is built.
 */
export function IconControl({ node, control }: { node: ElementNode; control: ControlDef }) {
  const id = useId();
  const projectId = useEditorStore((s) => s.projectId);
  const libraries = useEditorStore((s) => s.project.iconLibraries);
  const setProp = useEditorStore((s) => s.setElementProp);
  const [picking, setPicking] = useState(false);
  const libraryKey = control.libraryKey ?? "library";
  const library = dynamicTextOf(node.props[libraryKey]);
  const name = dynamicTextOf(node.props[control.key]);
  // A library that was turned off still shows while an icon uses it.
  const options = libraries
    .filter((l) => l.enabled || l.key === library)
    .map((l) => ({ value: l.key, label: l.name }));
  const setName = (next: string) => setProp(node.id, control.key, parseDynamicText(next));

  return (
    <>
      <SelectField
        compact
        label="Icon library"
        value={library}
        options={options}
        description={
          options.length === 0
            ? "Install an icon library in Design System > Fonts & Icons."
            : undefined
        }
        onValueChange={(next) => setProp(node.id, libraryKey, next)}
      />
      <SettingRow label={control.label} htmlFor={id}>
        <div className="relative">
          <input
            id={id}
            value={name}
            placeholder="home"
            onChange={(e) => setName(e.target.value)}
            className={compactFieldClass + " pr-16"}
          />
          <button
            type="button"
            aria-label="Choose an icon"
            data-tip="Choose an icon"
            onClick={() => setPicking(true)}
            className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-default hover:text-foreground"
          >
            <Icon name="ph:squares-four" width={14} height={14} />
          </button>
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <DynamicBolt
              label={control.label}
              onInsert={(token) => setName(`${name}${tagText(token)}`)}
            />
          </div>
        </div>
      </SettingRow>
      {picking ? (
        <IconPickerDialog
          projectId={projectId}
          libraries={libraries}
          value={library && name ? { library, name } : null}
          onClose={() => setPicking(false)}
          onPick={(ref) => {
            setProp(node.id, libraryKey, ref.library);
            setProp(node.id, control.key, ref.name);
            setPicking(false);
          }}
        />
      ) : null}
    </>
  );
}
