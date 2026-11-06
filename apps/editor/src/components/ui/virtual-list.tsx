"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A scrolling list that renders only the rows in view (plus a few more), for long lists such as the
 * class manager. Every row must be `rowHeight` pixels tall.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  overscan = 8,
  getKey,
  renderRow,
  className
}: {
  items: readonly T[];
  rowHeight: number;
  overscan?: number;
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight || 600);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const first = Math.max(0, Math.floor(top / rowHeight) - overscan);
  const last = Math.min(items.length, Math.ceil((top + height) / rowHeight) + overscan);

  return (
    <ul
      ref={ref}
      className={className}
      onScroll={(e) => setTop(e.currentTarget.scrollTop)}
      style={{ position: "relative" }}
    >
      <li aria-hidden style={{ height: first * rowHeight, listStyle: "none" }} />
      {items.slice(first, last).map((item) => (
        <li key={getKey(item)} style={{ height: rowHeight }} className="list-none">
          {renderRow(item)}
        </li>
      ))}
      <li aria-hidden style={{ height: (items.length - last) * rowHeight, listStyle: "none" }} />
    </ul>
  );
}
