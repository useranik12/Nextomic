"use client";

import { useEffect, useState } from "react";

/** The current time as hh:mm:ss AM or PM (12-hour, zero padded). */
export function formatClock(date: Date): string {
  const hours = date.getHours();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours % 12 === 0 ? 12 : hours % 12)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${hours < 12 ? "AM" : "PM"}`;
}

/** A running clock for the top bar. Nothing renders until mounted, so server and client agree. */
export function EditorClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!now) return null;
  return (
    <time
      dateTime={now.toISOString()}
      aria-label="Current time"
      className="font-mono text-[12px] tabular-nums text-muted"
    >
      {formatClock(now)}
    </time>
  );
}
