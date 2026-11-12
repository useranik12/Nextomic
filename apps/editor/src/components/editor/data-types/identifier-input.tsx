"use client";

import { stateNameProblem } from "@nextomic/schema";
import { useEffect, useState } from "react";
import { compactFieldClass } from "../right-panel/setting-row";

/** A name input that commits a valid, free identifier on blur or Enter and says why otherwise. */
export function IdentifierInput({
  label,
  value,
  taken,
  onCommit,
  className
}: {
  label: string;
  value: string;
  taken: readonly string[];
  onCommit: (name: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const problem = draft === value ? null : stateNameProblem(draft, taken);
  const commit = () => {
    if (draft === value) return;
    if (problem) setDraft(value);
    else onCommit(draft);
  };
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <input
        aria-label={label}
        aria-invalid={Boolean(problem)}
        value={draft}
        onChange={(e) => setDraft(e.target.value.trim())}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(value);
        }}
        className={`${compactFieldClass} font-mono ${problem ? "!border-danger" : ""}`}
      />
      {problem ? (
        <p role="alert" className="mt-0.5 px-2 text-xs text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
