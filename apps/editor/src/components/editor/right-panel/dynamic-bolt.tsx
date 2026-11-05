"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";

interface TokenOption {
  token: string;
  label: string;
  hint: string;
}

function useTokenOptions(): { group: string; items: TokenOption[] }[] {
  const params = useEditorStore((s) => s.doc?.settings.params ?? []);
  const state = useEditorStore((s) => s.doc?.settings.state ?? []);
  return [
    {
      group: "Page parameters",
      items: params.map((p) => ({ token: `param.${p.name}`, label: p.name, hint: p.type }))
    },
    {
      group: "Page state",
      items: state.map((v) => ({ token: `state.${v.name}`, label: v.name, hint: v.type }))
    }
  ].filter((g) => g.items.length > 0);
}

/**
 * The bolt on a field: pick a dynamic value and it is inserted into the field as a {{token}}.
 * Sources are the page's parameters and state variables; queries and loops add theirs later.
 */
export function DynamicBolt({
  label,
  onInsert,
  disabledReason
}: {
  label: string;
  onInsert: (token: string) => void;
  /** When set the bolt is shown but cannot be used yet, and this says why. */
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const groups = useTokenOptions();
  const button =
    "flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300 " +
    (disabledReason
      ? "text-default-300"
      : "text-default-500 hover:bg-default-200 hover:text-warning");

  if (disabledReason) {
    return (
      <button
        type="button"
        aria-label={`Dynamic value for ${label} (unavailable)`}
        title={disabledReason}
        aria-disabled="true"
        className={button + " cursor-not-allowed"}
      >
        <Icon name="ph:lightning" width={14} height={14} />
      </button>
    );
  }

  return (
    <Popover isOpen={open} onOpenChange={setOpen} placement="bottom-end" offset={6}>
      <PopoverTrigger>
        <button type="button" aria-label={`Dynamic value for ${label}`} className={button}>
          <Icon name="ph:lightning" width={14} height={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 items-stretch rounded-large border border-default-200 p-2">
        <p className="px-2 pb-1 pt-1 text-tiny font-semibold uppercase text-default-500">
          Dynamic data
        </p>
        {groups.length === 0 ? (
          <p className="px-2 pb-2 text-small text-default-500">
            Add page parameters or state variables, then use them here.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.group} className="mb-1">
              <p className="px-2 pt-1 text-tiny text-default-500">{group.group}</p>
              {group.items.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => {
                    onInsert(item.token);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-medium px-2 py-1.5 text-left text-small text-foreground transition-colors duration-300 hover:bg-default-100"
                >
                  <span className="truncate">{item.label}</span>
                  <span className="text-tiny text-default-500">{item.hint}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
