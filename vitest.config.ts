import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 reads the editor tsconfig (jsx: preserve, for Next); tests need the JSX compiled.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/editor/src", import.meta.url)) } },
  test: {
    include: [
      "packages/*/src/**/*.test.{ts,tsx}",
      "apps/editor/src/**/*.test.{ts,tsx}",
      "apps/auth-studio/src/**/*.test.ts"
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "**/graphify-out/**"]
  }
});
