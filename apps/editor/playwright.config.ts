import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  expect: { timeout: 15_000 },
  webServer: {
    command: "bun run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000"
  }
});
