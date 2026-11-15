"use client";

import { tagText } from "@nextomic/schema";
import { useState } from "react";
import { ColorField } from "@/components/ui/color-field";
import { Icon } from "@/lib/icons/Icon";
import { IconPickerDialog } from "../design-system/icons/icon-picker-dialog";
import { useEditorStore } from "../store/editor-store";
import { DynamicBolt } from "./dynamic-bolt";
import { compactFieldClass } from "./setting-row";

type Exclude = ("params" | "state")[];

/** The default value of a Color parameter: the swatch and picker, with the dynamic bolt beside it. */
export function ColorParamField({
  label,
  value,
  exclude,
  onChange,
  className
}: {
  label: string;
  value: string;
  exclude: Exclude;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={"flex min-w-0 items-center gap-1 " + (className ?? "")}>
      <ColorField label={label} value={value} onChange={onChange} className="min-w-0 flex-1" />
      <DynamicBolt
        label={label}
        exclude={exclude}
        onInsert={(token) => onChange(`${value}${tagText(token)}`)}
      />
    </div>
  );
}

/** An icon parameter's value is written `library:name` (for example `ph:star`). */
function splitIcon(value: string): { library: string; name: string } | null {
  const [library, name, ...rest] = value.split(":");
  return library && name && rest.length === 0 ? { library, name } : null;
}

/** The default value of an Icon parameter: `library:name` text, the icon picker, and the bolt. */
export function IconParamField({
  label,
  value,
  exclude,
  onChange,
  className
}: {
  label: string;
  value: string;
  exclude: Exclude;
  onChange: (value: string) => void;
  className?: string;
}) {
  const projectId = useEditorStore((s) => s.projectId);
  const libraries = useEditorStore((s) => s.project.iconLibraries);
  const [picking, setPicking] = useState(false);
  return (
    <div className={"relative min-w-0 " + (className ?? "")}>
      <input
        aria-label={label}
        placeholder="library:name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={compactFieldClass + " pr-16"}
      />
      <button
        type="button"
        aria-label={`Choose an icon for ${label}`}
        data-tip="Choose an icon"
        onClick={() => setPicking(true)}
        className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-default hover:text-foreground"
      >
        <Icon name="ph:squares-four" width={14} height={14} />
      </button>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
        <DynamicBolt
          label={label}
          exclude={exclude}
          onInsert={(token) => onChange(`${value}${tagText(token)}`)}
        />
      </div>
      {picking ? (
        <IconPickerDialog
          projectId={projectId}
          libraries={libraries}
          value={splitIcon(value)}
          onClose={() => setPicking(false)}
          onPick={(ref) => {
            onChange(`${ref.library}:${ref.name}`);
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}
