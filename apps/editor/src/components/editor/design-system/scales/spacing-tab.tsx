"use client";

import { useState } from "react";
import { FrameworkGate } from "../framework/framework-gate";
import type { ScaleKind } from "@nextomic/schema";
import { ScaleEditor } from "./scale-editor";

const KINDS: { id: Exclude<ScaleKind, "text">; label: string }[] = [
  { id: "space", label: "Spacing" },
  { id: "radius", label: "Radius" }
];

/** Design System > Spacing: the fluid spacing and radius scales of the theme's framework. */
export function SpacingTab() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("space");
  return (
    <FrameworkGate title="Spacing">
      {(props) => (
        <div className="flex h-full min-h-0 flex-col">
          <div
            className="flex items-center gap-1 border-b border-divider px-3 py-2"
            role="group"
            aria-label="Scale"
          >
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className={
                  "rounded-full px-3 py-1 text-small transition-colors duration-300 " +
                  (kind === k.id
                    ? "bg-default-800 text-default-50"
                    : "text-default-600 hover:bg-default-100")
                }
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <ScaleEditor kind={kind} {...props} />
          </div>
        </div>
      )}
    </FrameworkGate>
  );
}
