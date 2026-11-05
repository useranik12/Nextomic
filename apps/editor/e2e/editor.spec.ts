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

test("canvas zoom, wheel zoom and rotate", async ({ page }) => {
  await signUpAndCreateProject(page);
  const toolbar = page.getByRole("toolbar", { name: "Canvas view" });
  const percent = toolbar.getByRole("button", { name: "Actual size (100%)" });
  await toolbar.getByRole("button", { name: "Zoom in" }).click();
  const afterButton = await percent.innerText();
  await percent.click();
  await expect(percent).toHaveText("100%");
  expect(afterButton).not.toBe("100%");

  // Wheel over the canvas surround zooms.
  const box = await toolbar.boundingBox();
  if (!box) throw new Error("toolbar not visible");
  await page.mouse.move(box.x + box.width / 2, box.y - 150);
  await page.mouse.wheel(0, -400);
  await expect(percent).not.toHaveText("100%");
  await toolbar.getByRole("button", { name: "Fit to screen" }).click();

  // Rotate is for non-base breakpoints only.
  await expect(toolbar.getByRole("button", { name: "Rotate device" })).toBeDisabled();
  await page.getByRole("group", { name: "Breakpoints" }).getByRole("button").nth(1).click();
  await toolbar.getByRole("button", { name: "Rotate device" }).click();
  await expect(toolbar.getByRole("button", { name: "Rotate device" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("page settings: SEO, language, duplicate and home page", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Page settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("SEO title").fill("My landing page");
  await dialog.getByLabel("Page language").selectOption("fr");
  await dialog.getByRole("button", { name: "Duplicate page" }).click();
  // The copy opens, with its own name, and is not the home page.
  await expect(page.getByRole("button", { name: /copy/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Page settings" }).click();
  await expect(page.getByRole("dialog").getByLabel("SEO title")).toHaveValue("My landing page");
  await expect(
    page.getByRole("dialog").getByRole("switch", { name: "Home page" })
  ).not.toBeChecked();
});

test("drag an element tile onto the canvas inserts it", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  const tile = page.getByRole("button", { name: "Section", exact: true });
  const from = await tile.boundingBox();
  const frame = await page.locator('iframe[title="Page canvas"]').boundingBox();
  if (!from || !frame) throw new Error("layout not ready");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 10, { steps: 5 });
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 120, { steps: 10 });
  await page.waitForTimeout(300);
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 125, { steps: 2 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await expect(page.getByRole("treeitem")).toHaveCount(1);
});
