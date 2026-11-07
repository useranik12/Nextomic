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

test("connect Supabase with the anon key, fetch, inspect and clear the schema", async ({
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

  await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Refetch Schema" })).toBeVisible();
  const tables = page.getByRole("list", { name: "Tables" });
  await expect(tables.getByRole("button").first()).toBeVisible();
  // Primary keys show a key; PostgreSQL types use their short names.
  await expect(page.getByRole("img", { name: "Primary key" }).first()).toBeVisible();
  await expect(page.getByText("timestamp with time zone")).toHaveCount(0);

  // Panels stay within 700px; app auth is off, so the Google toggle is off and disabled.
  for (const name of ["Tables & Views", "Storage"]) {
    const box = await page.getByRole("region", { name }).boundingBox();
    expect(box?.height ?? 0).toBeLessThanOrEqual(700);
  }
  await expect(page.getByRole("switch", { name: "Google Authentication" })).toBeDisabled();

  // A Postgres enum (schema-qualified like public.role) saves into the app's enums.
  // The owner's test project has user_meta.role (public.role); other projects may have none.
  const withEnum = page
    .getByRole("list", { name: "Tables" })
    .getByRole("button", { name: "user_meta", exact: true });
  if (await withEnum.count()) {
    await withEnum.click();
    const enumButton = page.getByRole("button", { name: "Save enum role" });
    await enumButton.click();
    await expect(page.getByText("Use letters, digits and _")).toHaveCount(0);
    await expect(enumButton).toBeDisabled();
  }

  await page.getByRole("button", { name: "Clear Schema" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear Schema" }).click();
  await expect(page.getByText("Schema cleared.")).toBeVisible();
  await expect(page.getByText("Fetch the schema to see the tables and views.")).toBeVisible();
});
