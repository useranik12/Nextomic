"use client";

import { sampleSvg, type IconSample } from "@nextomic/schema";
import { useMemo, type ReactNode } from "react";

export interface IconChip {
  label: string;
  /** Plain-words explanation shown on hover. */
  tip: string;
  tone?: "default" | "warning";
}

/** Four sample icons in a row, drawn from sanitized SVG (animated sets keep moving). */
function PreviewStrip({ samples, label }: { samples: readonly IconSample[]; label: string }) {
  const drawn = useMemo(
    () => samples.map((s) => ({ name: s.name, svg: sampleSvg(s) })).filter((s) => s.svg),
    [samples]
  );
  return (
    <div
      role="img"
      aria-label={`${label} sample icons`}
      className="grid w-[8.5rem] shrink-0 grid-cols-4 gap-1"
    >
      {drawn.map((s) => (
        <span
          key={s.name}
          aria-hidden
          className="flex h-8 items-center justify-center text-foreground [&>svg]:h-6 [&>svg]:w-auto [&>svg]:max-w-8"
          dangerouslySetInnerHTML={{ __html: s.svg as string }}
        />
      ))}
    </div>
  );
}

function Chip({ chip }: { chip: IconChip }) {
  return (
    <span
      data-tip={chip.tip}
      className={
        "rounded-full px-2 py-0.5 text-[11px] leading-4 " +
        (chip.tone === "warning" ? "bg-warning/15 text-warning" : "bg-default-hover text-body")
      }
    >
      {chip.label}
    </span>
  );
}

/**
 * One icon library: preview strip, name with chips, a line of facts, the library key, and the
 * actions on the right. Used for installed libraries and for the catalog alike.
 */
export function IconSetRow({
  name,
  samples,
  facts,
  chips,
  libraryKey,
  actions,
  error
}: {
  name: string;
  samples: readonly IconSample[];
  facts: string;
  chips: readonly IconChip[];
  libraryKey: string;
  actions: ReactNode;
  error?: string | null;
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <PreviewStrip samples={samples} label={name} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            {chips.map((c) => (
              <Chip key={c.label} chip={c} />
            ))}
          </div>
          <p className="truncate text-xs text-muted">{facts}</p>
        </div>
        <code className="hidden shrink-0 text-xs text-muted md:block">{libraryKey}</code>
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      </div>
      {error ? (
        <p role="alert" className="pl-[9.5rem] text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
