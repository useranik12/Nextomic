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
  await dialog.getByLabel("SEO title", { exact: true }).fill("My landing page");
  await dialog.getByRole("button", { name: /Page language/ }).click();
  await page.locator("[role=option]", { hasText: "French (fr)" }).click();
  await dialog.getByRole("button", { name: "Duplicate page" }).click();
  // The copy opens, with its own name, and is not the home page.
  await expect(page.getByRole("button", { name: /copy/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Page settings" }).click();
  await expect(page.getByRole("dialog").getByLabel("SEO title", { exact: true })).toHaveValue(
    "My landing page"
  );
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
  const published = await request.get(site);
  expect(published.status()).toBe(200);
  // The theme's CSS is its own cacheable file, linked from the page.
  const href = /href="(\/theme-css\/[^"]+\.css\?v=\d+)"/.exec(await published.text())?.[1];
  expect(href).toBeTruthy();
  const themeFile = await request.get(href ?? "");
  expect(themeFile.status()).toBe(200);
  expect(themeFile.headers()["content-type"]).toContain("text/css");
  expect(themeFile.headers()["cache-control"]).toContain("immutable");
  expect(await themeFile.text()).toContain("data-nxt-theme");
  await page.getByRole("button", { name: "More publish options" }).click();
  await page.getByRole("menuitem", { name: /Unpublish/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unpublished" })).toBeVisible();
  expect((await request.get(site)).status()).toBe(404);
  expect((await request.get(href ?? "")).status()).toBe(404);
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

test("navigator right-click selects, aspect ratio options, dynamic style value, same names", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page
    .getByLabel("Elements", { exact: true })
    .getByRole("button", { name: "Heading" })
    .click();

  // Right-click the first row: it becomes the selected element and the menu shows Rename.
  await page.getByRole("treeitem").first().click({ button: "right" });
  await expect(page.getByRole("treeitem").first()).toHaveAttribute("aria-selected", "true");
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page.getByRole("status").filter({ hasText: "duplicated" })).toBeVisible();

  // Two elements may share a name.
  await page.getByLabel("Element name").first().fill("Same");
  await page.getByLabel("Element name").first().press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Renamed to Same" })).toBeVisible();

  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByRole("button", { name: "Size", exact: true }).click();
  await page.getByLabel("Aspect ratio", { exact: true }).focus();
  await page.getByRole("button", { name: "16 / 9", exact: true }).click();
  await expect(page.getByLabel("Aspect ratio", { exact: true })).toHaveValue("16 / 9");

  // The dynamic bolt on a design value is live.
  await expect(page.getByRole("button", { name: "Dynamic value for Width" })).toBeEnabled();
});

test("custom CSS file applies, and a heading's styles convert to a class", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');

  await page.getByRole("button", { name: "Design System" }).click();
  await page.getByRole("button", { name: /Custom CSS/ }).click();
  await page.getByRole("button", { name: "New CSS file" }).click();
  await page.getByLabel("CSS of styles-1.css").fill("h1,h2,h3,h4,h5,h6{letter-spacing:7px}");
  await page.getByRole("button", { name: "Close the Design System" }).click();
  await page.getByRole("button", { name: "Save and close" }).click();
  await expect(canvas.getByRole("heading")).toHaveCSS("letter-spacing", "7px");

  // Convert element styles to a class.
  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByRole("button", { name: "Size", exact: true }).click();
  await page.getByLabel("Width", { exact: true }).fill("120");
  await page.getByRole("button", { name: "CSS", exact: true }).click();
  await page.getByLabel("Convert styles to a class").fill("wide");
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  await expect(canvas.getByRole("heading")).toHaveCSS("width", "120px");
  await expect(canvas.getByRole("heading")).toHaveClass(/wide/);
});

test("animations: build a timeline, preview it on the canvas, see its GSAP code", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toBeVisible();

  await page.getByRole("button", { name: "Animations", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Animations" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "New timeline" }).click();
  await dialog.getByLabel("Trigger", { exact: true }).click();
  await page.getByRole("option", { name: "Page load" }).click();

  // Every setting carries an info tip.
  await expect(dialog.getByRole("button", { name: /^Trigger:/ })).toBeVisible();

  await dialog.getByRole("button", { name: "Add animation" }).click();
  // Target the page's heading and make it fade out (opacity 0 -> a value we can see mid-way).
  await dialog.getByLabel("Target", { exact: true }).fill("h1,h2,h3,h4,h5,h6");
  await dialog.getByLabel("Method", { exact: true }).click();
  await page.getByRole("option", { name: /^To \(/ }).click();
  await dialog.getByLabel("Duration", { exact: true }).fill("0.5");

  // The animation shows as a bar on the timeline.
  await expect(
    dialog.getByRole("button", { name: /^Animation, starts at 0 seconds/ })
  ).toBeVisible();

  // The preview reloads shortly after an edit; its length shows when it has.
  await expect(dialog.getByText(/\/ 00\.50s/)).toBeVisible();
  await dialog.getByRole("button", { name: "Play preview" }).click();
  await expect(canvas.getByRole("heading")).toHaveCSS("opacity", "0", { timeout: 10_000 });
  await dialog.getByRole("button", { name: "Stop preview and go to the start" }).click();
  await expect(canvas.getByRole("heading")).toHaveCSS("opacity", "1");

  await dialog.getByRole("tab", { name: "GSAP Code" }).click();
  await expect(dialog.getByLabel("GSAP code of the timeline")).toContainText("gsap.timeline");
});

test("CSS animation setting with element picker, clock toggle and panel size reset", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toBeVisible();

  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByLabel("Animations").getByRole("button", { name: "Animations" }).click();
  await page.getByRole("button", { name: "Animation", exact: true }).click();
  await page.getByLabel("Search animations").fill("fade in d");
  await page.getByRole("option", { name: "Fade in down" }).click();
  await expect(page.getByRole("button", { name: "Animation", exact: true })).toHaveText(
    "Fade in down"
  );

  // Pick the trigger from the canvas.
  await page.getByRole("button", { name: "Pick an element for Trigger selector" }).click();
  await canvas.getByRole("heading").click();
  await expect(page.getByLabel("Trigger selector", { exact: true })).toHaveValue(/^#nxtomc-/);

  // The saved page plays the animation in the browser.
  await page.getByLabel("Trigger selector", { exact: true }).focus();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  await expect(preview.getByRole("heading")).toHaveCSS("animation-name", "nxt-anim-fade-in-down");
  await preview.close();

  // The clock appears when the App Settings switch is on.
  await page.getByRole("button", { name: "App Settings" }).click();
  await page.getByRole("switch", { name: "Show time in the editor" }).click();
  await expect(page.getByLabel("Current time")).toHaveText(/^\d\d:\d\d:\d\d (AM|PM)$/);

  // The Navigator header resets the side panel sizes.
  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reset side panel sizes" })).toBeVisible();
});

test("design group is remembered, states show on the canvas, styles move to a class", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toBeVisible();

  // A group opened without editing anything is remembered across selection changes.
  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByRole("button", { name: "Typography", exact: true }).click();
  await page.getByLabel("Font size", { exact: true }).fill("48");
  await page.getByRole("button", { name: "Border", exact: true }).click();
  await page.getByRole("treeitem").first().click();
  await page.getByRole("treeitem").first().click();
  await expect(page.getByRole("button", { name: "Border", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true"
  );

  // The Margin box (Spacing) has a variable picker and a dynamic tag button.
  await page.getByRole("button", { name: "Spacing", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Use a variable for Margin/ }).first()
  ).toBeVisible();

  // Right-click > Move element styles to class.
  await page.getByRole("treeitem").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move element styles to class" }).click();
  await expect(page.getByText("This project has no classes yet.")).toBeVisible();
});

test("icon tooltips, new class is created, button HTML tag shows names", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Button", exact: true }).click();

  // An icon button explains itself after the pointer rests on it.
  await page.mouse.move(5, 5);
  await page.getByRole("button", { name: "Reset side panel sizes" }).hover();
  await expect(
    page.getByRole("tooltip").filter({ hasText: "Reset the width of the side panels" })
  ).toBeVisible();

  // The HTML tag list shows plain tag names.
  await page.getByLabel("HTML tag", { exact: true }).click();
  await expect(page.getByRole("option", { name: "span", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "div", exact: true }).click();
  await expect(page.getByRole("treeitem").first()).toBeVisible();

  // A class typed on the element appears in the Design System.
  await page.getByRole("tab", { name: /design/i }).click();
  await page.getByRole("button", { name: "Add a class" }).click();
  await page.getByPlaceholder("New class name").fill("fresh-class");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Design System" }).click();
  await page.getByRole("button", { name: /^Classes/ }).click();
  await expect(page.getByText("fresh-class").first()).toBeVisible();
});

test("custom color mode: add it, preview it from the top bar, remove it", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Design System" }).click();
  await page.getByRole("button", { name: /^Themes/ }).click();

  // Light and dark only: the top bar keeps its two-way switch.
  await page.getByRole("switch", { name: /Dark mode for the whole site/ }).check({ force: true });
  await page.getByLabel("New mode name").fill("Sepia");
  await page.getByRole("button", { name: "Add mode" }).click();
  await expect(page.getByLabel("Mode sepia")).toHaveValue("Sepia");

  await page.getByRole("button", { name: "Close the Design System" }).click();
  await page.getByRole("button", { name: "Save and close" }).click();
  await page.getByRole("button", { name: "Preview a color mode" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Sepia" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Removing the mode brings the two-way switch back.
  await page.getByRole("button", { name: "Design System" }).click();
  await page.getByRole("button", { name: /^Themes/ }).click();
  await page.getByRole("button", { name: "Remove the Sepia mode" }).click();
  await page.getByRole("button", { name: "Close the Design System" }).click();
  await page.getByRole("button", { name: "Save and close" }).click();
  await expect(page.getByRole("button", { name: "Preview a color mode" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Preview the site in/ })).toBeVisible();
});

test("Pages & Templates: manager, marking, header template on the site, default 404", async ({
  page,
  request
}) => {
  const projectId = await signUpAndCreateProject(page);

  // Marking on the page: a missing category is created from the plus inside the box.
  await page.getByLabel("Category", { exact: true }).fill("News");
  await page.getByRole("button", { name: /Create category News/ }).click();
  await expect(
    page.getByRole("list", { name: "Applied categories" }).getByText("News")
  ).toBeVisible();
  await page.getByLabel("Tags", { exact: true }).fill("launch");
  await page.getByRole("button", { name: /Create tag launch/ }).click();
  await expect(page.getByRole("list", { name: "Applied tags" }).getByText("launch")).toBeVisible();
  await page.keyboard.press("Control+s");

  // Manager: tabs, layouts, search.
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  await expect(page.getByRole("tab", { name: /Pages/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Select Home")).toBeVisible();
  await page.getByRole("button", { name: "Column layout" }).click();
  await expect(page.getByRole("columnheader", { name: "Created by" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Home/ })).toBeVisible();
  await page.getByLabel("Search pages").fill("zzz");
  await expect(page.getByText("No pages match these filters.")).toBeVisible();
  await page.getByLabel("Search pages").fill("hom");
  await expect(page.getByRole("row", { name: /Home/ })).toBeVisible();

  // A header template: create it, edit it, publish it.
  await page.getByRole("tab", { name: /Templates/ }).click();
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Main header");
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "More actions for Main header" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByLabel("Editing context")).toContainText("Template");
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByRole("button", { name: "Template settings" }).click();
  await page.getByRole("button", { name: /^Status/ }).click();
  await page.getByRole("option", { name: "Published", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // Live: the header wraps the page content in landmarks; an unknown address shows the default 404.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
  const home = await (await request.get(`/site/${projectId}`)).text();
  expect(home).toContain("<header");
  expect(home).toContain('id="main-content"');
  expect(home).toContain("Skip to content");
  const missing = await request.get(`/site/${projectId}/no-such-page`);
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("Page not found");
});

test("Generate Screenshots makes one picture per page for the grid", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "App Settings" }).click();
  await page.getByRole("switch", { name: "Generate Screenshots" }).check({ force: true });
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  await expect(page.getByAltText("Screenshot of Home")).toBeVisible({ timeout: 25000 });
});

async function newHeaderTemplate(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  await page.getByRole("button", { name: "Column layout" }).click();
  await page.getByRole("tab", { name: /Templates/ }).click();
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: `More actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByLabel("Editing context")).toContainText("Template");
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByRole("button", { name: "Template settings" }).click();
}

test("conditions: nested group, excluding, whole site and the wrapping field picker", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await newHeaderTemplate(page, "Rules header");
  const conditions = page.getByRole("region", { name: "Conditions" });
  await conditions.getByRole("button", { name: "Rule", exact: true }).click();
  await conditions.getByRole("button", { name: "Group", exact: true }).click();
  // A group inside the new group.
  await conditions.getByRole("button", { name: "Group", exact: true }).nth(1).click();
  await expect(conditions.getByRole("button", { name: /Rule \d+ field/ })).toHaveCount(3);

  // The field picker searches and shows the whole name.
  await conditions.getByRole("button", { name: "Rule 1 field" }).first().click();
  await page.getByLabel("Search Rule 1 field").fill("whole");
  await page.getByRole("option", { name: "Whole site" }).click({ force: true });
  await expect(conditions.getByRole("button", { name: "Rule 1 field" }).first()).toContainText(
    "Whole site"
  );
  const exclude = conditions.getByRole("button", { name: "Rule 1 excluding" }).first();
  await exclude.click();
  await expect(exclude).toHaveAttribute("aria-pressed", "true");
});

test("sticky header settings reach the live site; scheduled status shows a date picker", async ({
  page,
  request
}) => {
  const projectId = await signUpAndCreateProject(page);
  await newHeaderTemplate(page, "Sticky header");
  await page.getByRole("button", { name: /^Status/ }).click();
  await page.getByRole("option", { name: "Scheduled", exact: true }).click();
  await expect(page.getByLabel("Go live at").first()).toBeVisible();
  await page.getByRole("button", { name: /^Status/ }).click();
  await page.getByRole("option", { name: "Published", exact: true }).click();
  await page.getByRole("switch", { name: "Sticky header" }).check({ force: true });
  await expect(page.getByLabel("Slide up after", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Sticky on scroll" }).check({ force: true });
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
  // The header also shows around the page in the editor canvas.
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  await page.getByRole("tab", { name: /Pages/ }).click();
  await page.getByRole("button", { name: "More actions for Home" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.frameLocator('iframe[title="Page canvas"]').getByRole("heading")).toBeVisible();
  const home = await (await request.get(`/site/${projectId}`)).text();
  expect(home).toContain("data-nxt-sticky");
  expect(home).toContain("nxt-anim-slide-out-up");
});

test("page settings: no header and footer choice, status can be scheduled", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Page settings", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Header and footer")).toHaveCount(0);
  await expect(dialog.getByText("Include in publish")).toHaveCount(0);
  await dialog.getByRole("button", { name: /^Status/ }).click();
  await page.locator("[role=option]", { hasText: "Scheduled" }).click();
  await expect(dialog.getByLabel("Go live at").first()).toBeVisible();
});
