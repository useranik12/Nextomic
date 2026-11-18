"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons/Icon";

/** Copies a dynamic tag's text ({{ ... }}); the icon turns into a check for a moment. */
export function CopyTagButton({
  text,
  label,
  className
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const copy = () => {
    const finish = (next: "done" | "failed") => {
      setState(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 1500);
    };
    navigator.clipboard.writeText(text).then(
      () => finish("done"),
      () => finish("failed")
    );
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={state === "failed" ? "Copy failed: the browser blocked the clipboard" : label}
      data-own-tip
      onClick={copy}
      className={
        "flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-300 hover:bg-default-300 " +
        (state === "failed" ? "text-danger" : "text-muted hover:text-foreground") +
        (className ? ` ${className}` : "")
      }
    >
      <Icon name={state === "done" ? "ph:check" : "ph:copy"} width={14} height={14} />
    </button>
  );
}
