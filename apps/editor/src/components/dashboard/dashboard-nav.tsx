"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/lib/icons/Icon";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "ph:squares-four" },
  { href: "/projects", label: "All Projects", icon: "ph:stack" },
  { href: "/settings", label: "Settings", icon: null }
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1" aria-label="Dashboard">
      {NAV_ITEMS.map((item) => {
        const isActive = (pathname ?? "").startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors duration-150",
              isActive
                ? "bg-default font-medium text-foreground"
                : "text-muted hover:bg-default/60 hover:text-foreground"
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon ? (
              <Icon
                name={item.icon}
                className={isActive ? "text-accent" : "text-subtle group-hover:text-body"}
              />
            ) : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
