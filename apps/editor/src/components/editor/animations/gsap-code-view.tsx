"use client";

import { timelineToGsapCode, type Timeline } from "@nextomic/schema";
import { useMemo } from "react";
import { ActionButton } from "@/components/ui/controls";
import { InfoTip } from "@/components/ui/info-tip";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";

/** The GSAP code the timeline stands for. Read-only: change the settings and the code follows. */
export function GsapCodeView({ timeline }: { timeline: Timeline }) {
  const showToast = useEditorStore((s) => s.showToast);
  const code = useMemo(() => timelineToGsapCode(timeline), [timeline]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      showToast("GSAP code copied");
    } catch {
      showToast("Could not copy. Select the code and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-small font-semibold">
          GSAP Code
          <InfoTip
            text="The same animation written as plain GSAP code, for reading, learning or using in your own scripts. It is generated from the settings, so it cannot be edited here."
            label="GSAP Code"
          />
        </span>
        <ActionButton size="sm" tone="ghost" className="ml-auto" onPress={() => void copy()}>
          <Icon name="ph:copy" width={14} height={14} />
          Copy
        </ActionButton>
      </div>
      <pre
        tabIndex={0}
        aria-label="GSAP code of the timeline"
        className="max-h-[60vh] overflow-auto rounded-medium bg-default-100 p-3 font-mono text-tiny leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-default-800/30"
      >
        {code}
      </pre>
    </div>
  );
}
