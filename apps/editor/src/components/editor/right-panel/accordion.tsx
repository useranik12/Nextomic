"use client";

import type { ReactNode } from "react";
import { Icon } from "@/lib/icons/Icon";

/**
 * One section of an accordion. The parent keeps which section is open, so only one is open at a
 * time and the editor knows which settings are being edited.
 */
export function AccordionSection({
  id,
  title,
  icon,
  open,
  onToggle,
  changed,
  children
}: {
  id: string;
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
  /** Dot beside the title: something inside is set. */
  changed?: boolean;
  children: ReactNode;
}) {
  const panelId = `acc-${id}`;
  return (
    <section
      data-accordion={id}
      className="border-b border-divider pb-3 last:border-b-0"
      aria-label={title}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        className="flex h-10 w-full items-center gap-2 rounded-medium px-1 text-left text-small font-medium text-foreground outline-none transition-colors duration-300 hover:bg-default-100 focus-visible:ring-1 focus-visible:ring-default-800/50"
      >
        <span className="flex shrink-0 text-default-600">{icon}</span>
        {title}
        {changed ? (
          <span
            role="img"
            aria-label="Has changes"
            className="h-1.5 w-1.5 rounded-full bg-warning"
          />
        ) : null}
        <Icon
          name="ph:caret-down"
          width={12}
          height={12}
          className={"ml-auto transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>
      {open ? (
        <div id={panelId} className="flex flex-col gap-6 px-1 pb-3 pt-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
