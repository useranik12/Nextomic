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
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign up" }).click();

  // Without SMTP_HOST, verification is not required (see lib/auth.ts), so sign-up signs the user
  // straight in. With SMTP configured the page shows "Check your email" instead.
  await expect(page).toHaveURL(/\/dashboard/);
});

test("sign in with wrong credentials shows an error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
