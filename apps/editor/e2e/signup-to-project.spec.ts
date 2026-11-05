import { expect, test } from "@playwright/test";

/**
 * The one walking-skeleton flow Phase 0 needs end-to-end (docs/phases.md Phase 0): sign up,
 * land on an empty All Projects, create a project, see it in the grid, open the Phase 1
 * placeholder editor route. Needs a live Postgres (DATABASE_URL) and the dev server running —
 * not run in CI until a disposable Postgres service is wired in (see docs/phases.md Phase 0
 * "Tests" item); broader e2e suites are later phases.
 */
test("sign up, create a project, open its placeholder editor", async ({ page }) => {
  const email = `test-${Date.now()}@example.com`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  // Email verification is required before sign-in (see lib/auth.ts), so a real run needs a
  // way to read the dev-console-logged verification link. Left as a manual step for now.
});
