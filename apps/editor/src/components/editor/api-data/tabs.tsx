"use client";

/** The pill tabs (Call Definition / Test API) and the underlined sub-tabs (Header, Body...). */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  variant
}: {
  label: string;
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  variant: "pill" | "underline";
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex w-fit max-w-full shrink-0 overflow-x-auto ${variant === "pill" ? "gap-1" : "gap-2 border-b border-divider"}`}
    >
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={
              variant === "pill"
                ? `whitespace-nowrap rounded-full px-3 py-1.5 text-small transition-colors duration-300 ${on ? "bg-default-100 text-foreground" : "text-default-500 hover:text-foreground"}`
                : `-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-small transition-colors duration-300 ${on ? "border-foreground text-foreground" : "border-transparent text-default-500 hover:text-foreground"}`
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
