"use client";

import { Icon } from "@/lib/icons/Icon";

/** The small trash button at the end of a repeater row. */
export function RemoveRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onPress}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-default-500 transition-colors duration-300 hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-default-800/50"
    >
      <Icon name="ph:trash" width={14} height={14} />
    </button>
  );
}
