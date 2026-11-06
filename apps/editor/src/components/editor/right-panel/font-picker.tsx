"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { SYSTEM_FONT_STACKS, fontStack } from "@nextomic/schema";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { previewProps, useStylePreview } from "./design-field-tools";

/** Event the editor shell listens for to open the Design System on a given tab. */
export const OPEN_DESIGN_SYSTEM_EVENT = "nxt:open-design-system";

const rowClass =
  "flex w-full items-center justify-between gap-2 rounded-medium px-2 py-1.5 text-left hover:bg-default-100";

/** The font button beside Font family: project fonts and system stacks, plus "Add font…". */
export function FontPicker({
  property,
  onPick
}: {
  property: string;
  onPick: (stack: string) => void;
}) {
  const fonts = useEditorStore((s) => s.project.fonts);
  const [open, setOpen] = useState(false);
  const preview = useStylePreview(property);

  function choose(stack: string) {
    preview.clear();
    onPick(stack);
    setOpen(false);
  }

  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) preview.clear();
        setOpen(next);
      }}
      placement="bottom-end"
    >
      <PopoverTrigger>
        <button
          type="button"
          aria-label="Pick a project font"
          title="Pick a project font"
          className="flex h-6 w-6 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-default-300 hover:text-foreground"
        >
          <Icon name="ph:text-aa" width={14} height={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 items-stretch gap-1 p-2">
        <ul className="max-h-64 overflow-y-auto">
          {fonts
            .filter((f) => f.active)
            .map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => choose(fontStack(f))}
                  {...previewProps(preview, fontStack(f))}
                >
                  <span style={{ fontFamily: fontStack(f) }} className="truncate text-small">
                    {f.family}
                  </span>
                  <span className="text-tiny text-default-500">
                    {f.source === "upload" ? "uploaded" : "Google"}
                  </span>
                </button>
              </li>
            ))}
          {SYSTEM_FONT_STACKS.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                className={rowClass}
                onClick={() => choose(s.value)}
                {...previewProps(preview, s.value)}
              >
                <span className="truncate text-small">{s.label}</span>
                <span className="text-tiny text-default-500">system</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={rowClass + " border-t border-divider text-small font-medium"}
          onClick={() => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent(OPEN_DESIGN_SYSTEM_EVENT, { detail: "fonts" }));
          }}
        >
          Add font…
        </button>
      </PopoverContent>
    </Popover>
  );
}
