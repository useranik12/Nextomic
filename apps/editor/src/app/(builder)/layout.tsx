import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { getFaviconAsset } from "@/lib/assets";
import { Providers } from "./providers";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Nextomic Builder",
  description: "Self-hosted visual builder for reactive, responsive web apps.",
  icons: { icon: getFaviconAsset("svg") }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
