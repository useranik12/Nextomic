import { expect, test, type Page } from "@playwright/test";

// The API Data page against a real https API: the owner's Supabase test project's REST root,
// called with the anon key as group API-key auth. Runs only when E2E_SUPABASE_URL and
// E2E_SUPABASE_ANON_KEY are set (root .env). Nothing is written to that project.

const url = process.env.E2E_SUPABASE_URL;
const anonKey = process.env.E2E_SUPABASE_ANON_KEY;

test.use({ actionTimeout: 30_000 });
test.skip(!url || !anonKey, "Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY to run.");

async function openEditor(page: Page) {
  const email = `api-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Api Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects" }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("API project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

test("create a group and a call, test it, add a JSON path and save", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "API Data", exact: true }).click();
  await expect(page.getByText("No API calls yet.")).toBeVisible();

  // Group: base URL and API-key auth (the key is sealed on the server).
  await page.getByRole("button", { name: "Add API call or group" }).click();
  await page.getByRole("menuitem", { name: "New API Group" }).click();
  await page.getByLabel("Group Name").fill("Supabase REST");
  await page.getByLabel("Base URL", { exact: true }).fill(`${url}/rest/v1`);
  await page.getByRole("tab", { name: "Authentication" }).click();
  await page.locator("button", { hasText: "No authentication" }).click();
  await page.getByRole("option", { name: "API key" }).click();
  await page.getByLabel("Key name").fill("apikey");
  await page.getByRole("textbox", { name: "API key" }).fill(anonKey ?? "");
  await page.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByRole("textbox", { name: "API key" })).toHaveValue("");
  expect(await page.content()).not.toContain(anonKey ?? "");

  // Call in the group, with a header and a variable.
  await page.getByRole("button", { name: "Add API call or group" }).click();
  await page.getByRole("menuitem", { name: "New API Call" }).click();
  await page.getByLabel("API Call Name").fill("Read schema");
  await page.locator("button", { hasText: "No group" }).click();
  await page.getByRole("option", { name: "Supabase REST" }).click();
  await page.getByLabel("Endpoint", { exact: true }).fill("/");
  await page.getByLabel("Add header as key:value").fill("Accept: [accept]");
  await page.getByRole("button", { name: "Add Header" }).click();
  await expect(page.getByText('"accept" is used but not defined in Variables.')).toBeVisible();
  await page.getByRole("tab", { name: "Variables" }).click();
  await page.getByRole("button", { name: "Add Variable" }).click();
  const name = page.getByLabel("Variable name");
  await name.fill("accept");
  await name.press("Enter");
  await page.getByLabel("Default value of accept").fill("application/openapi+json");
  await page.getByLabel("Default value of accept").blur();

  // Test with the draft, then pick a recommended path.
  await page.getByRole("tab", { name: "Test API" }).click();
  await page.getByRole("button", { name: "Test API Call" }).click();
  await expect(page.getByText(/Status: 200 \(Success\)/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("tab", { name: "Headers" }).first().click();
  await expect(page.getByRole("region", { name: "Request headers" })).toContainText("apikey: ••••");
  expect(await page.content()).not.toContain(anonKey ?? "");
  await page.getByRole("button", { name: "Add JSON Path" }).nth(1).click();
  await expect(page.getByLabel("JSON path").first()).not.toHaveValue("$");

  await page.getByRole("button", { name: "Save API" }).click();
  await expect(page.getByRole("button", { name: "Save API" })).toBeDisabled();
  const row = page.getByRole("button", { name: /Read schema/ });
  await expect(row).toContainText("GET");

  // Delete the call; the group stays.
  await page.getByRole("button", { name: "Delete API" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete API" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Supabase REST", exact: true })).toBeVisible();
});
