import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFaviconAsset } from "@/lib/assets";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nextomic Builder",
  description: "Self-hosted visual builder for reactive, responsive web apps.",
  icons: { icon: getFaviconAsset("svg") }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
