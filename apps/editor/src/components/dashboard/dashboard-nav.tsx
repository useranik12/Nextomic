"use client";

import { cn } from "@heroui/react";
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
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-medium px-3 py-2 text-small transition-colors",
              isActive
                ? "bg-content2 font-medium text-foreground"
                : "text-default-500 hover:bg-content1 hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.icon ? <Icon name={item.icon} /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
