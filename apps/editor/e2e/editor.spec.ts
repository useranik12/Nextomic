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
  await page.getByRole("button", { name: "Typography" }).click();
  await page.getByLabel("Font size", { exact: true }).fill("48");
  await expect(page.getByRole("img", { name: "Changed at this breakpoint" })).toBeVisible();

  // Saving is on request (Ctrl+S).
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });

  // Undo removes the style, redo brings it back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue("48");
  await page.keyboard.press("Control+s");
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
  await expect(preview.getByRole("heading", { name: "Hello from the editor" })).toHaveCSS(
    "font-size",
    "48px"
  );
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
  await dialog.getByRole("button", { name: /Page language/ }).click();
  await page.locator("[role=option]", { hasText: "French (fr)" }).click();
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

test("bolt, App Settings toggle, split publish", async ({ page, request }) => {
  const projectId = await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  // Flyout closed after the insert, and the section rail folded to icons.
  await expect(page.getByRole("dialog", { name: "Elements" })).toHaveCount(0);

  // Bolt on a content field; no per-element auto-ID switch any more.
  await expect(page.getByRole("button", { name: "Dynamic value for Text" })).toBeVisible();
  await expect(page.getByText("Generate element ID automatically")).toHaveCount(0);
  await page.getByRole("button", { name: "App Settings" }).click();
  await expect(page.getByText("Generate element ID automatically")).toBeVisible();

  // Publish: private until published, public after, private again after Unpublish.
  const site = `/site/${projectId}`;
  expect((await request.get(site)).status()).toBe(404);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
  expect((await request.get(site)).status()).toBe(200);
  await page.getByRole("button", { name: "More publish options" }).click();
  await page.getByRole("menuitem", { name: /Unpublish/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unpublished" })).toBeVisible();
  expect((await request.get(site)).status()).toBe(404);
});

test("breakpoints order themselves by width", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Manage breakpoints" }).click();
  await expect(page.getByRole("button", { name: /Move .* up/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Add breakpoint" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  // 480 sits between Tablet (768) and Mobile (414).
  const group = page.getByRole("group", { name: "Breakpoints" }).getByRole("button");
  await expect(group).toHaveCount(4);
  const names = await group.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(names).toEqual(["Desktop", "Tablet", "Breakpoint 3", "Mobile"]);
});

test("dynamic tags show real values on the canvas", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByLabel("Text", { exact: true }).fill("On {{page.name}} in {{now.year}}");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  const year = String(new Date().getFullYear());
  await expect(
    canvas.getByRole("heading", { name: new RegExp(`On Home in ${year}`) })
  ).toBeVisible();
});

test("every element gets an ID that shows in the ID field", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await expect(page.getByPlaceholder("No ID")).toHaveValue(/^#nxtomc-[a-z0-9]{8}$/);
});

test("margin sides are independent and numeric fields take only numbers", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByRole("button", { name: "Spacing" }).click();
  await page.getByRole("button", { name: "Each side on its own" }).first().click();
  await page.getByLabel("Margin top", { exact: true }).fill("10");
  await page.getByLabel("Margin left", { exact: true }).fill("20");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  const heading = canvas.getByRole("heading");
  await expect(heading).toHaveCSS("margin-top", "10px");
  await expect(heading).toHaveCSS("margin-left", "20px");
  await expect(heading).toHaveCSS("margin-right", "0px");

  // Letters never reach a numeric field.
  await page.getByRole("button", { name: "Size", exact: true }).click();
  const width = page.getByLabel("Width", { exact: true });
  await width.fill("12ab");
  await expect(width).toHaveValue("");
  await width.pressSequentially("12");
  await expect(heading).toHaveCSS("width", /px$/);
});

test("side panels can be resized with the keyboard", async ({ page }) => {
  await signUpAndCreateProject(page);
  const handle = page.getByRole("separator", { name: "Resize the settings panel" });
  const before = Number(await handle.getAttribute("aria-valuenow"));
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", String(before + 16));
});

test("version control off disables the page history limit", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "App Settings" }).click();
  await page.getByRole("switch", { name: "Version control" }).click();
  await page.getByRole("button", { name: "Page settings", exact: true }).click();
  await expect(page.getByRole("dialog").getByPlaceholder(/App default/)).toBeDisabled();
});

test("a page keeps only as many versions as its history limit", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Page settings", exact: true }).click();
  const limit = page.getByRole("dialog").getByPlaceholder(/App default/);
  await limit.fill("5");
  await limit.blur();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const text = page.getByLabel("Text", { exact: true });
  for (let i = 1; i <= 7; i += 1) {
    await text.fill(`Draft ${i}`);
    await page.keyboard.press("Control+s");
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  }
  await page.getByRole("button", { name: "Version History" }).click();
  await expect(page.getByText(/^Version \d+/)).toHaveCount(5);
});

test("design accordion opens one group, remembers the setting, steps with arrow keys", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByRole("tab", { name: /design/i }).click();
  await expect(page.getByRole("button", { name: "Layout" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await page.getByRole("button", { name: "Border" }).click();
  await expect(page.getByRole("button", { name: "Layout" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );

  // Arrow keys step a numeric value.
  await page.getByRole("button", { name: "Size", exact: true }).click();
  const width = page.getByLabel("Width", { exact: true });
  await width.fill("10");
  await width.press("ArrowUp");
  await expect(width).toHaveValue("11");
  await width.press("Shift+ArrowDown");
  await expect(width).toHaveValue("1");

  // A second element, then back: the first one reopens in Size.
  await page.getByRole("button", { name: "Add element" }).click();
  await page
    .getByLabel("Elements", { exact: true })
    .getByRole("button", { name: "Heading" })
    .click();
  await page.getByRole("treeitem").first().getByText("Heading").click();
  await page.getByRole("tab", { name: /design/i }).click();
  await expect(page.getByRole("button", { name: "Size", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
});

test("link buttons apply at once, rename and attributes work", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByRole("button", { name: "Spacing" }).click();
  await page.getByRole("button", { name: "Each side on its own" }).first().click();
  await page.getByLabel("Margin top", { exact: true }).fill("30");
  await page.getByLabel("Margin left", { exact: true }).fill("8");
  await page.getByRole("button", { name: "All sides linked" }).first().click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toHaveCSS("margin-top", "8px");
  await expect(canvas.getByRole("heading")).toHaveCSS("margin-bottom", "8px");

  // Rename from the panel header.
  await page.getByRole("button", { name: "Rename element" }).click();
  const name = page.getByLabel("Element name").first();
  await name.fill("Hero title");
  await name.press("Enter");
  await expect(page.getByRole("treeitem", { name: /Hero title/ })).toBeVisible();

  // Attributes get an ID and show on the canvas.
  await page.getByRole("tab", { name: /element/i }).click();
  await page.getByRole("button", { name: "Attributes" }).click();
  await page.getByPlaceholder("name, e.g. aria-label").fill("aria-label");
  await page.getByPlaceholder("value", { exact: true }).fill("Hello");
  await page.getByRole("button", { name: "Add attribute" }).click();
  await expect(canvas.getByRole("heading")).toHaveAttribute("aria-label", "Hello");
  await page.getByPlaceholder("name, e.g. aria-label").fill("onclick");
  await expect(page.getByText("This attribute is not allowed")).toBeVisible();
});
