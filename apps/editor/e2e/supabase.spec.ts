import { expect, test, type Page } from "@playwright/test";

// The Supabase page against the owner's real test project. Runs only when E2E_SUPABASE_URL and
// E2E_SUPABASE_ANON_KEY are set (root .env); nothing is written to that project.

const url = process.env.E2E_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY;

test.use({ actionTimeout: 30_000 });
test.skip(!url || !anonKey, "Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY to run.");

async function openEditor(page: Page) {
  const email = `supabase-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Supa Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects" }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Supabase project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

test("connect Supabase with the anon key, fetch, star, browse and clear the schema", async ({
  page
}) => {
  test.setTimeout(120_000);
  await openEditor(page);
  await page.getByRole("button", { name: "Supabase", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Supabase Connection" })).toBeVisible();
  await expect(page.getByText("Fetch the schema to see the tables and views.")).toBeVisible();

  await page.getByLabel("Supabase URL").fill(url ?? "");
  await page.getByLabel("Anon Key/Publishable Key").fill(anonKey ?? "");
  await page.getByRole("button", { name: "Fetch Schema" }).click();
  await expect(page.getByText("Schema fetched.")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("switch", { name: "Active" })).toBeChecked();
  // The key never comes back to the page; only a hint that one is saved.
  await expect(page.getByLabel("Anon Key/Publishable Key")).toHaveValue("");
  expect(await page.content()).not.toContain(anonKey ?? "");

  const tables = page.getByRole("list", { name: "Tables and views" });
  await expect(tables.getByRole("button").first()).toBeVisible();
  const star = page.getByRole("button", { name: /^Star / }).first();
  const starName = (await star.getAttribute("aria-label"))?.replace(/^Star /, "") ?? "";
  await star.click();
  await expect(page.getByRole("button", { name: `Unstar ${starName}` })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Supabase", exact: true }).click();
  await expect(page.getByRole("button", { name: `Unstar ${starName}` })).toBeVisible();

  await page.getByRole("button", { name: "Clear Schema" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear Schema" }).click();
  await expect(page.getByText("Schema cleared.")).toBeVisible();
  await expect(page.getByText("Fetch the schema to see the tables and views.")).toBeVisible();
});
