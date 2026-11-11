"use client";

import { HeroUIProvider } from "@heroui-v2/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { AutoTooltips } from "@/components/ui/auto-tooltips";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
        {children}
        <AutoTooltips />
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
