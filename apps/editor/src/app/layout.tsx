import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Nextomic Builder",
  description: "Self-hosted visual builder for dynamic web applications."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return (
    <html className="dark" lang="en">
      <body>{children}</body>
    </html>
  );
}
