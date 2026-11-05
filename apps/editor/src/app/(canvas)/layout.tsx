import type { ReactNode } from "react";

// Separate root layout: the canvas and preview documents get none of the builder's CSS
// (Tailwind, HeroUI), so built-site styles never mix with builder styles.
export default function CanvasRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
