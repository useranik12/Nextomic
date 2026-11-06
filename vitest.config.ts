import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/editor/src", import.meta.url)) } },
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/editor/src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/graphify-out/**"]
  }
});
