import { useId, type ReactNode } from "react";

/**
 * A titled group of settings. Groups after the first are set off by a divider, so a long list of
 * switches and fields reads as a few sections.
 */
export function SettingsGroup({
  title,
  first = false,
  children
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-3 ${first ? "" : "border-t border-border pt-4"}`}
    >
      <h3 id={id} className="text-sm font-medium text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
