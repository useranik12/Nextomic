"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { AutoTooltips } from "@/components/ui/auto-tooltips";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
      <AutoTooltips />
    </NextThemesProvider>
  );
}
