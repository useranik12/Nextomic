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
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
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
  await expect(page.getByLabel("Schema", { exact: true })).toHaveValue("public");
  await page.getByLabel("Anon Key/Publishable Key").fill(anonKey ?? "");
  await page.getByRole("button", { name: "Fetch Schema" }).click();
  await expect(page.getByText("Schema fetched.")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("switch", { name: "Active" })).toBeChecked();
  // The key never comes back to the page; only a hint that one is saved.
  await expect(page.getByLabel("Anon Key/Publishable Key")).toHaveValue("");
  expect(await page.content()).not.toContain(anonKey ?? "");

  await expect(page.getByText("Connected", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Refetch Schema" })).toBeVisible();
  // One schema saved: no schema tabs.
  await expect(page.getByRole("tablist", { name: "Database schemas" })).toHaveCount(0);
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
  await expect(page.getByText("Schema public cleared.")).toBeVisible();
  await expect(page.getByText("Fetch the schema to see the tables and views.")).toBeVisible();
});

test("a Container runs a Supabase query loop set in the Query Loop group", async ({ page }) => {
  test.setTimeout(150_000);
  await openEditor(page);
  await page.getByRole("button", { name: "Supabase", exact: true }).click();
  await page.getByLabel("Supabase URL").fill(url ?? "");
  await page.getByLabel("Anon Key/Publishable Key").fill(anonKey ?? "");
  await page.getByRole("button", { name: "Fetch Schema" }).click();
  await expect(page.getByText("Schema fetched.")).toBeVisible({ timeout: 60_000 });
  const firstTable = page.getByRole("list", { name: "Tables" }).getByRole("button").first();
  const tableName = (await firstTable.innerText()).trim().split("\n")[0] ?? "";

  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Container", exact: true }).click();
  // Only Container and Section have the group.
  const group = page.getByRole("button", { name: "Query Loop" });
  await group.click();
  const settings = page.getByRole("region", { name: "Query Loop" });
  await page.getByRole("switch", { name: "Enable Query Loop" }).click({ force: true });
  await expect(page.getByLabel("Query Type", { exact: true })).toBeVisible();
  // A new loop is named after its source; renaming it changes how the children read it.
  const loopName = settings.getByLabel("Loop name", { exact: true });
  await expect(loopName).toHaveValue("supabaseLoop");
  await loopName.fill("posts");
  await loopName.press("Enter");

  const tablePicker = settings.getByRole("combobox", { name: "Table or view" });
  await tablePicker.fill(tableName);
  await page.getByRole("option", { name: tableName, exact: true }).click();
  await expect(settings.getByText("Choose a table or view.")).toHaveCount(0);

  await settings.getByRole("button", { name: "Add filter" }).click();
  await expect(settings.getByRole("button", { name: /Remove filter on/ })).toBeVisible();
  await settings.getByRole("button", { name: "Add order" }).click();
  await expect(settings.getByRole("button", { name: /Remove order by/ })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Enable realtime query" })).not.toBeChecked();

  // The Navigator marks the element with the orange query icon.
  await expect(
    page.getByRole("button", { name: /^Open the query loop of .*: Supabase Query$/ })
  ).toBeVisible();

  // Turning the query off keeps its settings.
  await page.getByRole("switch", { name: "Enable Query Loop" }).click({ force: true });
  await expect(
    page.getByRole("button", { name: /^Open the query loop of .*: Supabase Query$/ })
  ).toHaveCount(0);
  await page.getByRole("switch", { name: "Enable Query Loop" }).click({ force: true });
  await expect(tablePicker).toHaveValue(tableName);

  // A heading inside the loop repeats once per row the anon key can read (limit 20).
  const answer = await page.request.get(`${url}/rest/v1/${tableName}?select=*&limit=20`, {
    headers: { apikey: anonKey ?? "", Authorization: `Bearer ${anonKey ?? ""}` }
  });
  const expected: unknown = answer.ok() ? await answer.json() : [];
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toHaveCount(
    Array.isArray(expected) ? expected.length : 0,
    { timeout: 30_000 }
  );

  // The heading's dynamic data offers the loop's row tags as %name.
  await page.getByRole("button", { name: "Dynamic value for Text" }).click();
  const tags = page.getByRole("dialog");
  const loopGroup = "%posts · Container (Supabase Query)";
  await tags.getByRole("button", { name: "Added Queries" }).click();
  await expect(tags.getByText(loopGroup)).toBeVisible();
  const loopTags = tags.locator("details", { hasText: loopGroup }).last();
  await expect(loopTags.getByText("{{ %posts.item }}", { exact: true })).toBeVisible();
  await expect(loopTags.getByText("{{ %posts.index }}", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // The preview renders the loop on the server with the same rows.
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15_000
  });
  const projectId = /\/editor\/([^/?#]+)/.exec(page.url())?.[1] ?? "";
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  await expect(preview.getByRole("heading")).toHaveCount(
    Array.isArray(expected) ? expected.length : 0
  );
});

test("a published query loop loads more rows on scroll through the site endpoint", async ({
  page,
  request
}) => {
  test.setTimeout(150_000);
  await openEditor(page);
  await page.getByRole("button", { name: "Supabase", exact: true }).click();
  await page.getByLabel("Supabase URL").fill(url ?? "");
  await page.getByLabel("Anon Key/Publishable Key").fill(anonKey ?? "");
  await page.getByRole("button", { name: "Fetch Schema" }).click();
  await expect(page.getByText("Schema fetched.")).toBeVisible({ timeout: 60_000 });
  const firstTable = page.getByRole("list", { name: "Tables" }).getByRole("button").first();
  const tableName = (await firstTable.innerText()).trim().split("\n")[0] ?? "";

  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Container", exact: true }).click();
  await page.getByRole("button", { name: "Query Loop" }).click();
  await page.getByRole("switch", { name: "Enable Query Loop" }).click({ force: true });
  const settings = page.getByRole("region", { name: "Query Loop" });
  await settings.getByRole("combobox", { name: "Table or view" }).fill(tableName);
  await page.getByRole("option", { name: tableName, exact: true }).click();
  await settings.getByLabel("Limit").fill("5");
  await page.getByRole("switch", { name: "Infinite scroll" }).click({ force: true });
  await page.getByRole("switch", { name: "Enable realtime query" }).click({ force: true });
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
  const projectId = /\/editor\/([^/?#]+)/.exec(page.url())?.[1] ?? "";

  // The server render sends the first 5 rows; scrolling loads more through the endpoint.
  const site = await page.context().newPage();
  const socket = site.waitForEvent("websocket", {
    predicate: (ws) => ws.url().includes("/realtime/v1/websocket"),
    timeout: 30_000
  });
  await site.goto(`/site/${projectId}`);
  const loop = site.locator("[data-nx-loop]");
  await expect(loop).toHaveAttribute("data-nx-scroll", "");
  // Realtime: the page subscribes to the table with the anon key only.
  await expect(loop).toHaveAttribute("data-nx-realtime", `public.${tableName}`);
  expect((await socket).url()).toContain(`apikey=${anonKey ?? ""}`);
  await expect(site.getByRole("heading")).not.toHaveCount(0);
  for (let i = 0; i < 4; i++) {
    await site.getByRole("heading").last().scrollIntoViewIfNeeded();
    await site.waitForTimeout(400);
  }
  await expect
    .poll(async () => site.getByRole("heading").count(), { timeout: 30_000 })
    .toBeGreaterThan(5);
  const rows = await site
    .locator("[data-nx-row]")
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-nx-row"))));
  expect(rows).toEqual(rows.map((_, i) => i));

  // The endpoint only answers for loop runs of the published page.
  const forged = await request.post(`/api/site/${projectId}/loop`, {
    data: { route: "/", key: "nxtomc-nothere", offset: 0 }
  });
  expect(forged.status()).toBe(404);
  const malformed = await request.post(`/api/site/${projectId}/loop`, {
    data: { route: "/", key: "a b", offset: -1 }
  });
  expect(malformed.status()).toBe(400);
});

test("Refresh Query shows the loop's Supabase settings with tips and dynamic data", async ({
  page
}) => {
  test.setTimeout(150_000);
  await openEditor(page);
  await page.getByRole("button", { name: "Supabase", exact: true }).click();
  await page.getByLabel("Supabase URL").fill(url ?? "");
  await page.getByLabel("Anon Key/Publishable Key").fill(anonKey ?? "");
  await page.getByRole("button", { name: "Fetch Schema" }).click();
  await expect(page.getByText("Schema fetched.")).toBeVisible({ timeout: 60_000 });
  const firstTable = page.getByRole("list", { name: "Tables" }).getByRole("button").first();
  const tableName = (await firstTable.innerText()).trim().split("\n")[0] ?? "";

  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Container", exact: true }).click();
  await page.getByRole("button", { name: "Query Loop" }).click();
  const settings = page.getByRole("region", { name: "Query Loop" });
  await page.getByRole("switch", { name: "Enable Query Loop" }).click({ force: true });
  const tablePicker = settings.getByRole("combobox", { name: "Table or view" });
  await tablePicker.fill(tableName);
  await page.getByRole("option", { name: tableName, exact: true }).click();
  await settings.getByRole("button", { name: "Add filter" }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("tab", { name: /action/i }).click();
  await page.getByRole("button", { name: "Add action" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Choose a trigger" }).click();
  await page.locator("[role=menuitem]", { hasText: /^On Click$/ }).click();
  await modal.getByRole("button", { name: "Add Action", exact: true }).click();
  await modal.getByLabel("Search actions").fill("Refresh");
  await modal.getByRole("button", { name: "Refresh Supabase Query" }).click();
  await modal.getByRole("button", { name: /^Query loop/ }).click();
  await page.locator("[role=option]", { hasText: "supabaseLoop" }).click();

  // Every setting of the loop, prefilled, with tips saying what the loop uses.
  await expect(modal.getByRole("combobox", { name: "Table or view" })).toHaveValue(tableName);
  await expect(modal.getByRole("button", { name: /^Table or view: The loop reads/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /^Column: The loop uses/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /^Condition: The loop uses/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: /^Value: The loop uses/ })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Dynamic value for Value" })).toBeVisible();
  await expect(modal.getByRole("switch", { name: "Enable realtime query" })).toBeDisabled();
  await modal
    .getByRole("button", { name: /^Enable realtime query: The loop has realtime off/ })
    .focus();
  await expect(page.locator("[role=tooltip]")).toContainText(
    "A refresh keeps the loop's own setting"
  );
  await modal.getByRole("button", { name: "Add filter" }).click();
  await expect(
    modal.getByRole("button", { name: /^Column: Added here: the loop has no such filter/ })
  ).toBeVisible();
  await page.screenshot({ path: "C:/Users/zaynt/.claude/jobs/63a9e151/tmp/supa.png" });
});

test("a saved Query Row(s) action runs on the server from the preview and refuses unknown nodes", async ({
  page
}) => {
  test.setTimeout(150_000);
  await openEditor(page);
  await page.getByRole("button", { name: "Supabase", exact: true }).click();
  await page.getByLabel("Supabase URL").fill(url ?? "");
  await page.getByLabel("Anon Key/Publishable Key").fill(anonKey ?? "");
  await page.getByRole("button", { name: "Fetch Schema" }).click();
  await expect(page.getByText("Schema fetched.")).toBeVisible({ timeout: 60_000 });
  const firstTable = page.getByRole("list", { name: "Tables" }).getByRole("button").first();
  const tableName = (await firstTable.innerText()).trim().split("\n")[0] ?? "";

  // The editor reads the table list when it loads, so reload after the fetch.
  await page.reload();
  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("tab", { name: /action/i }).click();
  await page.getByRole("button", { name: "Add action" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Choose a trigger" }).click();
  await page.locator("[role=menuitem]", { hasText: /^On Click$/ }).click();
  await modal.getByRole("button", { name: "Add Action", exact: true }).click();
  await modal.getByLabel("Search actions").fill("Query Row");
  await modal.getByRole("button", { name: "Query Row(s)" }).click();
  await modal
    .getByRole("button", { name: /^Table/ })
    .first()
    .click();
  await page.locator("[role=option]", { hasText: tableName }).first().click();
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal.getByText("Unsaved changes")).toBeHidden({ timeout: 10_000 });
  await modal.getByRole("button", { name: "Close the Action Flow Editor" }).click();

  const projectId = /\/editor\/([^/?#]+)/.exec(page.url())?.[1] ?? "";
  const direct = await page.request.get(`${url}/rest/v1/${tableName}?select=*&limit=100`, {
    headers: { apikey: anonKey ?? "", Authorization: `Bearer ${anonKey ?? ""}` }
  });
  const expected: unknown = direct.ok() ? await direct.json() : [];

  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const answered = preview.waitForResponse((r) =>
    r.url().includes(`/api/site/${projectId}/action`)
  );
  await preview.getByRole("button").first().click();
  const response = await answered;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { data: unknown };
  expect(Array.isArray(body.data) ? body.data.length : -1).toBe(
    Array.isArray(expected) ? expected.length : 0
  );

  // Only saved action nodes run: an invented node id is refused.
  const refused = await preview.request.post(`/api/site/${projectId}/action`, {
    data: { mode: "preview", node: "not-a-node", values: [], route: "/" },
    headers: { origin: new URL(preview.url()).origin }
  });
  expect(refused.status()).toBe(404);
});
