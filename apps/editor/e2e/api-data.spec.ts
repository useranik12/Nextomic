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
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
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
  // A group variable every call can use.
  await page.getByRole("tab", { name: "Variables" }).click();
  await page.getByRole("button", { name: "Add Variable" }).click();
  const groupVar = page.getByLabel("Variable name");
  await groupVar.fill("profile");
  await groupVar.press("Enter");
  await page.getByLabel("Default value of profile").fill("public");
  await page.getByLabel("Default value of profile").blur();
  await page.getByRole("button", { name: "Add Variable" }).click();
  const sizeVar = page.getByLabel("Variable name").nth(1);
  await sizeVar.fill("page_size");
  await sizeVar.press("Enter");
  await page.getByLabel("Default value of page_size").fill("1");
  await page.getByLabel("Default value of page_size").blur();
  await page.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByRole("button", { name: "Save Group" })).toBeDisabled();
  await page.getByRole("tab", { name: "Authentication" }).click();
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

  // Typing [ closes the bracket and lists the variables (call, group, server); Enter inserts.
  await page.getByRole("tab", { name: "Header" }).click();
  const addHeader = page.getByLabel("Add header as key:value");
  await addHeader.click();
  await page.keyboard.type("Accept-Profile: [pro");
  const list = page.getByRole("listbox", { name: "Variables" });
  await expect(list.getByRole("option", { name: /profile/ })).toBeVisible();
  await expect(list).toContainText("Default: public");
  await page.keyboard.press("Enter");
  await expect(addHeader).toHaveValue("Accept-Profile: [profile]");
  await page.getByRole("button", { name: "Add Header" }).click();

  // A query parameter is added to the URL for us.
  await page.getByRole("tab", { name: "Query" }).click();
  await page.getByLabel("Add query parameter as key:value").fill("limit: [page_size]");
  await page.getByRole("button", { name: "Add Query Parameter" }).click();

  // Test with the draft, then pick a recommended path.
  await page.getByRole("tab", { name: "Test API" }).click();
  // The request preview follows the inputs before any test runs; the key stays masked.
  await expect(page.getByRole("region", { name: "Called URL" })).toContainText("?limit=1");
  await page.getByRole("tab", { name: "Headers" }).click();
  await expect(page.getByRole("region", { name: "Request headers" })).toContainText("apikey: ••••");
  await page.getByRole("button", { name: "Test API Call" }).click();
  await expect(page.getByText(/Status: 200 \(Success\)/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("tab", { name: "API URL" }).click();
  await expect(page.getByRole("region", { name: "Called URL" })).toContainText("?limit=1");
  await page.getByRole("tab", { name: "Headers" }).first().click();
  const sent = page.getByRole("region", { name: "Request headers" });
  await expect(sent).toContainText("apikey: ••••");
  await expect(sent).toContainText("accept-profile: public");
  expect(await page.content()).not.toContain(anonKey ?? "");
  await page.getByRole("button", { name: "Add JSON Path" }).nth(1).click();
  const path = page.getByLabel("JSON path").first();
  await expect(path).not.toHaveValue("$");

  // The eye shows only the picked path in the response viewer.
  await page.getByRole("tab", { name: "Test Response" }).click();
  const pathName = await page.getByLabel("Name", { exact: true }).first().inputValue();
  await page.getByRole("button", { name: `Show ${pathName} in the response viewer` }).click();
  await expect(page.getByText("Showing 1 picked JSON path.")).toBeVisible();
  const viewer = page.getByRole("region", { name: "Response JSON" });
  await expect(viewer).toContainText(`"${pathName}"`);
  await page.getByRole("button", { name: "Show whole response" }).click();
  await expect(page.getByText("Showing 1 picked JSON path.")).toHaveCount(0);

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

test("a Container runs a REST query loop with a group variable set in the loop", async ({
  page,
  request
}) => {
  test.setTimeout(150_000);
  // A table the anon key can read, from PostgREST's own description.
  const description = await request.get(`${url}/rest/v1/`, {
    headers: { apikey: anonKey ?? "", Accept: "application/openapi+json" }
  });
  const spec = (await description.json()) as { definitions?: Record<string, unknown> };
  const table = Object.keys(spec.definitions ?? {}).sort()[0] ?? "";
  expect(table).not.toBe("");

  await openEditor(page);
  await page.getByRole("button", { name: "API Data", exact: true }).click();
  await page.getByRole("button", { name: "Add API call or group" }).click();
  await page.getByRole("menuitem", { name: "New API Group" }).click();
  await page.getByLabel("Group Name").fill("Supabase REST");
  await page.getByLabel("Base URL", { exact: true }).fill(`${url}/rest/v1`);
  await page.getByRole("tab", { name: "Authentication" }).click();
  await page.locator("button", { hasText: "No authentication" }).click();
  await page.getByRole("option", { name: "API key" }).click();
  await page.getByLabel("Key name").fill("apikey");
  await page.getByRole("textbox", { name: "API key" }).fill(anonKey ?? "");
  await page.getByRole("tab", { name: "Variables" }).click();
  await page.getByRole("button", { name: "Add Variable" }).click();
  const sizeVar = page.getByLabel("Variable name");
  await sizeVar.fill("page_size");
  await sizeVar.press("Enter");
  await page.getByLabel("Default value of page_size").fill("1");
  await page.getByLabel("Default value of page_size").blur();
  await page.getByRole("button", { name: "Save Group" }).click();
  await expect(page.getByRole("button", { name: "Save Group" })).toBeDisabled();

  await page.getByRole("button", { name: "Add API call or group" }).click();
  await page.getByRole("menuitem", { name: "New API Call" }).click();
  await page.getByLabel("API Call Name").fill("Rows");
  await page.locator("button", { hasText: "No group" }).click();
  await page.getByRole("option", { name: "Supabase REST" }).click();
  await page.getByLabel("Endpoint", { exact: true }).fill(`/${table}`);
  await page.getByRole("tab", { name: "Query" }).click();
  await page.getByLabel("Add query parameter as key:value").fill("limit: [page_size]");
  await page.getByRole("button", { name: "Add Query Parameter" }).click();
  await page.getByRole("button", { name: "Save API" }).click();
  await expect(page.getByRole("button", { name: "Save API" })).toBeDisabled();

  // The loop sets the group's page_size to 4: four copies on the canvas.
  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Container", exact: true }).click();
  await page.getByRole("button", { name: "Query Loop" }).click();
  await page.getByRole("switch", { name: "Enable Query Loop" }).click({ force: true });
  const settings = page.getByRole("region", { name: "Query Loop" });
  await settings.getByLabel("Query Type", { exact: true }).click();
  await page.getByRole("option", { name: "REST API" }).click();
  await settings.getByLabel("API call", { exact: true }).click();
  await page.getByRole("option", { name: "Supabase REST / Rows" }).click();
  await settings.getByLabel("page_size", { exact: true }).fill("4");
  await expect(settings.getByLabel("List", { exact: true })).toBeVisible();
  // REST loops have no infinite scroll, and fetch on the canvas only after Fetch preview.
  await expect(page.getByRole("switch", { name: "Infinite scroll" })).toHaveCount(0);
  await expect(settings.getByText(/shows a placeholder until you fetch/)).toBeVisible();
  await settings.getByRole("button", { name: "Fetch preview", exact: true }).click();
  await expect(settings.getByRole("button", { name: "Fetch preview again" })).toBeVisible();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toHaveCount(4, { timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: /^Open the query loop of .*: REST API$/ })
  ).toBeVisible();

  // The preview's server render runs the same call with the same value.
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15_000
  });
  const projectId = /\/editor\/([^/?#]+)/.exec(page.url())?.[1] ?? "";
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  await expect(preview.getByRole("heading")).toHaveCount(4);
  expect(await preview.content()).not.toContain(anonKey ?? "");
});
