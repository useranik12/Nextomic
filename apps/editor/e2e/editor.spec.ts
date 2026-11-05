import { expect, test, type Page } from "@playwright/test";

async function signUpAndCreateProject(page: Page): Promise<string> {
  const email = `editor-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Editor Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "All Projects" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Walking skeleton");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  // Creating a project opens its editor.
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
  return page.url().split("/editor/")[1] ?? "";
}

test("create, edit, save, reload and preview a page", async ({ page }) => {
  const projectId = await signUpAndCreateProject(page);
  await expect(page.getByRole("tree", { name: "Page elements" })).toBeVisible();

  // Insert a section, then a heading inside it.
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Section", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(2);

  // Edit the heading text in the Element tab.
  await page.getByLabel("Text", { exact: true }).fill("Hello from the editor");

  // The sandboxed canvas shows it and a canvas click selects it.
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading", { name: "Hello from the editor" })).toBeVisible();

  // Style it at the base breakpoint, then check the change dot on the Design tab.
  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByLabel("Font size", { exact: true }).fill("48px");
  await expect(page.getByRole("img", { name: "Changed at this breakpoint" })).toBeVisible();

  // Autosave settles.
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });

  // Undo removes the style, redo brings it back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue("48px");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });

  await page.screenshot({ path: process.env.EDITOR_SHOT ?? "test-results/editor.png" });

  // Reload: the page comes back from the database.
  await page.reload();
  await expect(page.getByRole("treeitem")).toHaveCount(2);

  // Preview renders the saved page through the renderer.
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  await expect(preview.getByRole("heading", { name: "Hello from the editor" })).toBeVisible();
  expect(await preview.locator("style").first().innerHTML()).toContain("font-size:48px");
});

test("breakpoint manager adds a breakpoint and the switcher shows it", async ({ page }) => {
  await signUpAndCreateProject(page);
  await expect(page.getByRole("group", { name: "Breakpoints" }).getByRole("button")).toHaveCount(3);
  await page.getByRole("button", { name: "Manage breakpoints" }).click();
  await page.getByRole("button", { name: "Add breakpoint" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("group", { name: "Breakpoints" }).getByRole("button")).toHaveCount(4);
});

test("page options show when nothing is selected and element settings when selected", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await expect(page.getByText("Route Settings")).toBeVisible();
  await expect(page.getByLabel("Requires Authentication")).toBeVisible();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Container", exact: true }).click();
  await expect(page.getByRole("tab", { name: /element/i })).toBeVisible();
  await expect(page.getByText("Route Settings")).toHaveCount(0);
});
