import { expect, test, type Page } from "@playwright/test";

async function signUpAndCreateProject(page: Page): Promise<string> {
  const email = `editor-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Editor Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
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
  const text = page.getByLabel("Text", { exact: true });
  await text.fill("On {{ page.name }} in {{ $now.year }}");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  const year = String(new Date().getFullYear());
  await expect(
    canvas.getByRole("heading", { name: new RegExp(`On Home in ${year}`) })
  ).toBeVisible();

  // Without spaces inside the braces it is plain text; the prompt offers to fix it.
  await text.fill("On {{page.name}}");
  const prompt = page.getByRole("alertdialog", { name: "Make this a dynamic tag?" });
  await expect(prompt).toBeVisible();
  await expect(canvas.getByRole("heading", { name: "On {{page.name}}" })).toBeVisible();
  await prompt.getByRole("button", { name: "Fix tag" }).click();
  await expect(text).toHaveValue("On {{ page.name }}");
  await expect(canvas.getByRole("heading", { name: "On Home" })).toBeVisible();

  // Keep as text leaves it alone.
  await text.fill("Write {{name}} here");
  await prompt.getByRole("button", { name: "Keep as text" }).click();
  await expect(prompt).toHaveCount(0);
  await expect(text).toHaveValue("Write {{name}} here");
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
  await page
    .getByLabel("CSS of styles-1.css", { exact: true })
    .fill("h1,h2,h3,h4,h5,h6{letter-spacing:7px}");
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

test("themes: light and dark only, conditions are rules, custom CSS formats", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Design System" }).click();
  await page.getByRole("button", { name: /^Themes/ }).click();
  await page.getByRole("switch", { name: /Dark mode for the whole site/ }).check({ force: true });
  await expect(page.getByLabel("New mode name")).toHaveCount(0);

  // A second theme gets the same rule builder as templates.
  await page.getByLabel("New theme name").fill("Blog");
  await page.getByRole("button", { name: "New theme" }).click();
  const conditions = page.getByRole("region", { name: "Conditions" });
  await conditions.getByRole("button", { name: "Rule", exact: true }).click();
  await expect(conditions.getByRole("button", { name: "Rule 1 field" })).toBeVisible();

  // Custom CSS: the Format button tidies the code.
  await page
    .getByRole("button", { name: /Custom CSS/ })
    .first()
    .click();
  await page.getByRole("button", { name: "New CSS file" }).click();
  const css = page.getByLabel(/^CSS of styles/);
  await css.fill(".a{color:red}");
  await page.getByRole("button", { name: /^Format CSS of styles/ }).click();
  await expect(css).toHaveValue(".a {\n  color: red;\n}");
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
  // A press outside the cards clears the selection.
  await page.getByLabel("Select Home").click();
  await expect(page.getByLabel("Select Home")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: /Pages/ }).click();
  await expect(page.getByLabel("Select Home")).toHaveAttribute("aria-pressed", "false");
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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Status/ })
    .click();
  await page.locator("[role=option]", { hasText: "Published" }).click();
  // Without a condition a template never shows.
  await expect(page.getByText(/No conditions: this template never shows/)).toBeVisible();
  await addWholeSiteRule(page);
  await expect(page.getByText(/No conditions: this template never shows/)).toHaveCount(0);
  await page.getByRole("button", { name: "Done" }).click();
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
  // An image with no address used to stop the picture from being drawn.
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
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

/** Adds a Whole site rule in the open Template settings, so the template shows everywhere. */
async function addWholeSiteRule(page: Page): Promise<void> {
  const conditions = page.getByRole("region", { name: "Conditions" });
  await conditions.getByRole("button", { name: "Rule", exact: true }).click();
  await conditions.getByRole("button", { name: "Rule 1 field" }).click();
  await page.getByLabel("Search Rule 1 field").fill("whole");
  await page.locator("[role=option]", { hasText: "Whole site" }).click();
}

/**
 * A published modal template on the whole site with a required `title` parameter (default "Hi")
 * that its heading shows. Leaves the editor on the template.
 */
async function newModalTemplate(
  page: Page,
  kind: "Modal" | "Bottom Sheet" = "Modal"
): Promise<void> {
  const name = `Main ${kind.toLowerCase()}`;
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  await page.getByRole("button", { name: "Column layout" }).click();
  await page.getByRole("tab", { name: /Templates/ }).click();
  await page.getByRole("button", { name: "New template" }).click();
  const create = page.getByRole("dialog");
  await create.getByLabel("Name").fill(name);
  await create.getByRole("button", { name: /^Type/ }).click();
  await page.locator("[role=option]", { hasText: kind }).click();
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: `More actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByLabel("Editing context")).toContainText("Template");

  // A required parameter needs a default value before it saves.
  await page.getByRole("button", { name: "Edit Template Parameters" }).click();
  await page.getByRole("button", { name: "Add parameter" }).click();
  await page.getByLabel("Parameter name").fill("title");
  await page.getByRole("checkbox", { name: "Required" }).check({ force: true });
  await expect(page.getByText("A required parameter needs a default value.")).toBeVisible();
  await page.getByRole("textbox", { name: "Default value for title" }).fill("Hi");
  await page.getByRole("button", { name: "Save Template Parameters" }).click();
  await expect(page.getByLabel("required", { exact: true })).toBeVisible();

  // A new modal template is a blank canvas: its design is up to the user.
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toHaveCount(0);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByLabel("Text", { exact: true }).fill("{{ param.title }}");
  await expect(canvas.getByRole("heading", { name: "Hi" })).toBeVisible();

  await page.getByRole("button", { name: "Template settings" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Status/ })
    .click();
  await page.locator("[role=option]", { hasText: "Published" }).click();
  await addWholeSiteRule(page);
  await page.getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
}

/** Opens Home in the editor from Pages & Templates. */
async function editHome(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  await page.getByRole("tab", { name: /Pages/ }).click();
  await page.getByRole("button", { name: "More actions for Home" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByLabel("Editing context")).not.toContainText("Template");
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
  await page.locator("[role=option]", { hasText: "Whole site" }).click();
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
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Status/ })
    .click();
  await page.locator("[role=option]", { hasText: "Scheduled" }).click();
  await expect(page.getByLabel("Go live at").first()).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Status/ })
    .click();
  await page.locator("[role=option]", { hasText: "Published" }).click();
  await addWholeSiteRule(page);
  await page.getByRole("switch", { name: "Sticky header" }).check({ force: true });
  await expect(page.getByLabel("Slide up after", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Sticky on scroll" }).check({ force: true });
  await page.getByRole("button", { name: "Done" }).click();
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

test("state management: drafts, guard, and values feed dynamic data", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "State Management" }).click();
  await expect(page.getByRole("heading", { name: "State Management" })).toBeVisible();

  // App State: add, rename, type, default, persist with storage details.
  await page.getByRole("button", { name: "Add Variable" }).click();
  const name = page.getByLabel("Variable name");
  await name.fill("cart_count");
  await name.press("Enter");
  await page.locator("[aria-label='Type of cart_count']").click();
  await expect(page.locator("[role=option]", { hasText: "ENUM" })).toHaveAttribute(
    "data-disabled",
    "true"
  );
  await page.locator("[role=option]", { hasText: /^Int$/ }).click();
  await page.getByLabel("Default value of cart_count").fill("2.5");
  await expect(page.getByText("Expected a whole number.")).toBeVisible();
  await page.getByLabel("Default value of cart_count").fill("3");
  await page.getByRole("switch", { name: "Persist cart_count" }).click({ force: true });
  await page.getByRole("button", { name: "Show details of cart_count" }).click();
  await expect(page.getByText("Keep after logout")).toBeVisible();

  // Reserved names are refused.
  await page.getByRole("button", { name: "Add Variable" }).click();
  const second = page.getByLabel("Variable name").nth(1);
  await second.fill("user");
  await expect(page.getByText('"user" is a reserved word.')).toBeVisible();
  await second.press("Escape");

  // Leaving with unsaved changes asks first; Keep editing stays.
  await page.getByRole("tab", { name: /Constants/ }).click();
  const guard = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("tab", { name: /App State/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await page.getByRole("button", { name: "Save App State" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Constants, discarded once, then saved.
  await page.getByRole("tab", { name: /Constants/ }).click();
  await page.getByRole("button", { name: "Add Variable" }).click();
  await page.getByRole("button", { name: "Discard changes to Constants" }).click();
  await expect(page.getByText("No constants yet.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Add Variable" }).click();
  const constName = page.getByLabel("Variable name");
  await constName.fill("support_email");
  await constName.press("Enter");
  await page.getByLabel("Value of support_email").fill("help@example.com");
  await page.getByRole("button", { name: "Save Constants" }).click();

  // Both groups show in the bolt picker and resolve on the canvas.
  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByRole("button", { name: "Dynamic value for Text" }).click();
  const picker = page.getByRole("dialog");
  await expect(picker.getByText("App state", { exact: true }).first()).toBeVisible();
  await expect(picker.getByText("cart_count").first()).toBeVisible();
  await picker.getByText("support_email").first().click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading", { name: /help@example\.com/ })).toBeVisible();
});

test("data types: enums and custom data types become state types", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Data Types" }).click();
  await expect(page.getByRole("heading", { name: "Data Types" })).toBeVisible();

  // An enum with two values, saved.
  await page.getByRole("tab", { name: "ENUM" }).click();
  await page.getByRole("button", { name: "Add enum" }).click();
  const value = page.getByLabel("New enum value");
  await value.fill("small");
  await value.press("Enter");
  await value.fill("large");
  await value.press("Enter");
  await value.fill("small");
  await expect(page.getByText("That value is already in the list.")).toBeVisible();
  await value.fill("");
  await page.getByRole("button", { name: "Save enum Enum_1" }).click();

  // A data type cannot use itself as a field type; ENUM picks which enum beside the type.
  await page.getByRole("tab", { name: "Custom Data Types" }).click();
  await page.getByRole("button", { name: "Add data type" }).click();
  await page.getByRole("button", { name: "Add Field" }).click();
  await page.locator("[aria-label='Type of field_1']").click();
  await expect(page.locator("[role=option]", { hasText: "Data Type" })).toHaveAttribute(
    "data-disabled",
    "true"
  );
  await page.locator("[role=option]", { hasText: "ENUM" }).click();
  await expect(page.locator("[aria-label='Enum for Type of field_1']")).toBeVisible();
  await page.getByRole("button", { name: "Save data type DataType_1" }).click();

  // The enum is a type for app state, and its values are the only choices.
  await page.getByRole("button", { name: "State Management" }).click();
  await page.getByRole("button", { name: "Add Variable" }).click();
  const name = page.getByLabel("Variable name");
  await name.fill("size");
  await name.press("Enter");
  await page.locator("[aria-label='Type of size']").click();
  await page.locator("[role=option]", { hasText: "ENUM" }).click();
  await page.locator("[aria-label='Default value of size']").click();
  await expect(page.locator("[role=option]", { hasText: "large" })).toBeVisible();
  await page.locator("[role=option]", { hasText: "large" }).click();

  // A data type variable chooses which data type beside the type.
  await page.getByRole("button", { name: "Add Variable" }).click();
  const address = page.getByLabel("Variable name").last();
  await address.fill("address");
  await address.press("Enter");
  await page.locator("[aria-label='Type of address']").click();
  await page.locator("[role=option]", { hasText: "Data Type" }).click();
  await expect(page.locator("[aria-label='Data Type for Type of address']")).toBeVisible();

  // A JSON value can be formatted.
  await page.getByRole("button", { name: "Add Variable" }).click();
  const third = page.getByLabel("Variable name").last();
  await third.fill("settings");
  await third.press("Enter");
  await page.locator("[aria-label='Type of settings']").click();
  await page.getByRole("option", { name: "JSON", exact: true }).last().click();
  const json = page.getByLabel("Default value of settings", { exact: true });
  await json.fill('{"a":1}');
  await page.getByRole("button", { name: "Format Default value of settings" }).click();
  await expect(json).toHaveValue('{\n  "a": 1\n}');
});

test("expressions: auto close, grouped suggestions, result, invalid tags", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "State Management" }).click();
  await page.getByRole("tab", { name: /Constants/ }).click();
  await page.getByRole("button", { name: "Add Variable" }).click();
  const constName = page.getByLabel("Variable name");
  await constName.fill("brand");
  await constName.press("Enter");
  await page.getByLabel("Value of brand").fill("nextomic");
  await page.getByRole("button", { name: "Save Constants" }).click();

  await page.getByRole("button", { name: "Navigator" }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const text = page.getByLabel("Text", { exact: true });
  await text.fill("");
  await text.pressSequentially("Hi {{");
  await expect(text).toHaveValue("Hi {{  }}");
  // The panel sits beside the field, not over it.
  const fieldBox = await text.boundingBox();
  const panelBox = await page.getByRole("dialog", { name: "Expression suggestions" }).boundingBox();
  expect(
    panelBox!.x + panelBox!.width <= fieldBox!.x || panelBox!.x >= fieldBox!.x + fieldBox!.width
  ).toBe(true);
  const panel = page.getByRole("dialog", { name: "Expression suggestions" });
  await expect(panel.getByRole("option", { name: /const.brand/ })).toBeVisible();
  await expect(panel.getByText("Functions", { exact: true }).first()).toBeVisible();
  await text.pressSequentially("const.brand.toUp");
  await expect(panel.getByRole("option", { name: /toUpperCase/ })).toBeVisible();
  await expect(panel.getByText("All letters in capitals.")).toBeVisible();
  await text.press("Enter");
  await expect(text).toHaveValue("Hi {{ const.brand.toUpperCase() }}");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading", { name: "Hi NEXTOMIC" })).toBeVisible();

  // Deleting a brace of "{{" also removes its "}}".
  await text.fill("Hi {{ a }}");
  await text.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(5, 5));
  await text.press("Backspace");
  await expect(text).toHaveValue("Hi { a");

  // Nothing is suggested inside a string; an unknown variable marks the element in the Navigator.
  await text.fill("{{ const.brand.replace('n");
  await expect(panel).toHaveCount(0);
  await text.fill("{{ const.nope }}");
  await expect(page.getByRole("img", { name: /Invalid dynamic data/ })).toBeVisible();
});

test("publish menu: schedule a publish and remove it", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "More publish options" }).click();
  await page.getByText("Schedule publish", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Schedule publish" });
  await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
  const chip = page.getByRole("button", { name: /^Publishes / });
  await expect(chip).toBeVisible();

  // Publishing now asks first, since only one publish state can stand.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const replace = page.getByRole("dialog", { name: "A publish is scheduled" });
  await replace.getByRole("button", { name: "Keep schedule" }).click();
  await expect(chip).toBeVisible();

  await page.getByRole("button", { name: "More publish options" }).click();
  await page.getByText("Edit schedule", { exact: true }).click();
  await page
    .getByRole("dialog", { name: "Schedule publish" })
    .getByRole("button", { name: "Schedule", exact: true })
    .click();
  await chip.click();
  await page
    .getByRole("dialog", { name: "Schedule publish" })
    .getByRole("button", { name: "Remove schedule" })
    .click();
  await expect(chip).toHaveCount(0);

  // Scheduled again, then published now: the schedule goes away.
  await page.getByRole("button", { name: "More publish options" }).click();
  await page.getByText("Schedule publish", { exact: true }).click();
  await page
    .getByRole("dialog", { name: "Schedule publish" })
    .getByRole("button", { name: "Schedule", exact: true })
    .click();
  await expect(chip).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .getByRole("dialog", { name: "A publish is scheduled" })
    .getByRole("button", { name: "Publish now and remove schedule" })
    .click();
  await expect(chip).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Published", exact: true })).toBeVisible();
});

test("connector proxy guards: sign-in, same origin, JSON, project scope", async ({
  page,
  playwright
}) => {
  const projectId = await signUpAndCreateProject(page);
  const path = `/api/projects/${projectId}/connectors/missing`;
  const json = { "content-type": "application/json" };

  const anonymous = await playwright.request.newContext({ baseURL: page.url() });
  const signedOut = await anonymous.post(path, { headers: json, data: { op: "test" } });
  expect(signedOut.status()).toBe(401);
  await anonymous.dispose();

  const crossSite = await page.request.post(path, {
    headers: { ...json, origin: "https://evil.example" },
    data: { op: "test" }
  });
  expect(crossSite.status()).toBe(403);

  const notJson = await page.request.post(path, {
    headers: { "content-type": "text/plain" },
    data: "{}"
  });
  expect(notJson.status()).toBe(415);

  const otherProject = await page.request.post(`/api/projects/not-mine/connectors/missing`, {
    headers: json,
    data: { op: "test" }
  });
  expect(otherProject.status()).toBe(403);

  const badOp = await page.request.post(path, { headers: json, data: { op: "drop" } });
  expect(badOp.status()).toBe(400);

  const missing = await page.request.post(path, { headers: json, data: { op: "test" } });
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({
    ok: false,
    error: { code: "not_found", message: "Connector not found." }
  });
});

test("App Settings: home page and app authentication", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "App Settings" }).click();
  await expect(page.locator("button", { hasText: "Home (/)" })).toBeVisible();
  // Requires Authentication waits for authentication to be turned on.
  const requires = page.getByLabel("Requires Authentication");
  await page.getByRole("switch", { name: "Use authentication" }).click({ force: true });
  const byDefault = page.getByLabel("New pages require authentication");
  await expect(byDefault).toBeEnabled();
  await byDefault.check({ force: true });
  await expect(byDefault).toBeChecked();
  // Controls are disabled while the settings save; enabled again means the save finished.
  await expect(byDefault).toBeEnabled();
  await page.getByRole("button", { name: "Navigator" }).click();
  await expect(requires).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "App Settings" }).click();
  await expect(page.getByRole("switch", { name: "Use authentication" })).toBeChecked();
  await expect(page.getByLabel("New pages require authentication")).toBeChecked();
});

test("an Other Loops query loop repeats static JSON on the canvas and the preview", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Container", exact: true }).click();
  await page.getByRole("button", { name: "Query Loop" }).click();
  await page.getByRole("switch", { name: "Enable Query Loop" }).click({ force: true });
  const settings = page.getByRole("region", { name: "Query Loop" });
  await settings.getByLabel("Query Type", { exact: true }).click();
  await page.getByRole("option", { name: "Other Loops" }).click();
  // A default name follows the type and the source.
  const loopName = settings.getByLabel("Loop name", { exact: true });
  await expect(loopName).toHaveValue("appStateLoop");
  await expect(settings.getByText("Choose a variable.")).toBeVisible();
  await settings.getByLabel("Source", { exact: true }).click();
  await page.getByRole("option", { name: "Static JSON" }).click();
  await expect(loopName).toHaveValue("jsonLoop");
  await settings
    .getByRole("textbox", { name: "Static JSON" })
    .fill('[{"t":"A"},{"t":"B"},{"t":"C"}]');
  await expect(settings.getByText(/must be an array|not valid/)).toHaveCount(0);

  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByLabel("Text", { exact: true }).fill("Item {{ %jsonLoop.item.t }}");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading")).toHaveText(["Item A", "Item B", "Item C"]);

  // The Navigator's query icon selects the container and opens its Query Loop settings.
  await page.getByRole("button", { name: /^Open the query loop of .*: Other Loops/ }).click();
  await expect(
    page.getByRole("region", { name: "Query Loop" }).getByLabel("Loop name", { exact: true })
  ).toHaveValue("jsonLoop");

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15_000
  });
  const projectId = /\/editor\/([^/?#]+)/.exec(page.url())?.[1] ?? "";
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  await expect(preview.getByRole("heading")).toHaveText(["Item A", "Item B", "Item C"]);
});

test("transforms: a tag is transformed in the bolt modal and reopened from the field", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  const text = page.getByLabel("Text", { exact: true });
  await text.fill("");
  await page.getByRole("button", { name: "Dynamic value for Text" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Transform Page name" }).click();
  await expect(modal.getByText("Starts as text")).toBeVisible();

  // Only steps that fit text are offered; the preview follows the chain.
  await modal.getByLabel("Add a transform", { exact: true }).click();
  await expect(page.locator("[role=option]", { hasText: "Text: Uppercase" })).toBeVisible();
  await expect(page.locator("[role=option]", { hasText: /^Number: Round$/ })).toHaveCount(0);
  await page.locator("[role=option]", { hasText: "Text: Uppercase" }).click();
  await expect(modal.locator("output")).toHaveText("HOME");
  await modal.getByRole("button", { name: "Insert" }).click();
  await expect(text).toHaveValue("{{ page.name?.toUpperCase() }}");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.getByRole("heading", { name: "HOME" })).toBeVisible();

  // With the caret inside the tag, the bolt reopens its transforms and updates the tag.
  await text.focus();
  await text.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  await page.getByRole("button", { name: "Dynamic value for Text" }).click();
  await expect(modal.getByRole("listitem").filter({ hasText: "Uppercase" })).toBeVisible();
  await modal.getByRole("button", { name: "Remove Uppercase" }).click();
  await modal.getByLabel("Add a transform", { exact: true }).click();
  await page.locator("[role=option]", { hasText: "Text: Truncate" }).click();
  await modal.getByRole("spinbutton", { name: "Length" }).fill("2");
  await modal.getByLabel("Fallback when empty").fill("Untitled");
  await expect(modal.locator("output")).toHaveText("Ho…");
  await modal.getByRole("button", { name: "Update tag" }).click();
  await expect(text).toHaveValue('{{ $ifEmpty(page.name?.truncate(2), "Untitled") }}');
  await expect(canvas.getByRole("heading", { name: "Ho…" })).toBeVisible();
});

test("conditions: a failing element leaves the canvas, turns yellow, and previews with Show", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByLabel("Text", { exact: true }).fill("Members only");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  const heading = canvas.getByRole("heading", { name: "Members only" });
  await expect(heading).toBeVisible();

  await page.getByRole("button", { name: "Conditions", exact: true }).click();
  await page.getByRole("button", { name: "Add condition" }).click();
  await page.getByLabel("Value", { exact: true }).fill("{{ page.name }}");
  await page.getByLabel("Compare with", { exact: true }).fill("Blog");
  // Gone from the canvas DOM, and the Navigator row is marked.
  await expect(heading).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Has conditions: hidden now" })).toBeVisible();
  await expect(page.getByText("so the element is hidden")).toBeVisible();

  // The preview switch shows it without changing the conditions.
  await page.getByRole("radio", { name: "Show" }).click();
  await expect(heading).toBeVisible();
  await page.getByRole("radio", { name: "Auto" }).click();
  await expect(heading).toHaveCount(0);

  // A matching compare value shows it again (text compares ignore case).
  await page.getByLabel("Compare with", { exact: true }).fill("home");
  await expect(heading).toBeVisible();
  await expect(page.getByRole("img", { name: "Has conditions", exact: true })).toBeVisible();

  // Switching the conditions off always shows the element.
  await page.getByLabel("Compare with", { exact: true }).fill("Blog");
  await expect(heading).toHaveCount(0);
  await page.getByRole("switch", { name: "Enable conditions" }).click({ force: true });
  await expect(heading).toBeVisible();
});

test("conditions: class checks and list values as chips", async ({ page }) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByLabel("Text", { exact: true }).fill("Panel");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  const heading = canvas.getByRole("heading", { name: "Panel" });
  await page.getByRole("button", { name: "Conditions", exact: true }).click();
  await page.getByRole("button", { name: "Add condition" }).click();

  // Class type: this element has no class "is-open", so "has" hides it and "does not have" shows it.
  await page.getByLabel("Condition type", { exact: true }).click();
  await page.locator("[role=option]", { hasText: "Class" }).click();
  await page.getByLabel("Class name", { exact: true }).fill("is-open");
  await expect(heading).toHaveCount(0);
  await page.getByLabel("Operator", { exact: true }).click();
  await page.locator("[role=option]", { hasText: "does not have" }).click();
  await expect(heading).toBeVisible();

  // Value comparison with "is in list": a comma or Enter makes a chip.
  await page.getByLabel("Condition type", { exact: true }).click();
  await page.locator("[role=option]", { hasText: "Value comparison" }).click();
  await page.getByLabel("Value", { exact: true }).fill("{{ page.name }}");
  await page.getByLabel("Operator", { exact: true }).click();
  await page.locator("[role=option]", { hasText: "is in list" }).first().click();
  const list = page.getByLabel("Compare with", { exact: true });
  await list.pressSequentially("Blog,");
  await expect(page.getByRole("button", { name: "Remove Blog" })).toBeVisible();
  await expect(heading).toHaveCount(0);
  await list.pressSequentially("Home");
  await list.press("Enter");
  await expect(heading).toBeVisible();

  // Backspace in the empty field removes the last chip whole.
  await list.press("Backspace");
  await expect(page.getByRole("button", { name: "Remove Home" })).toHaveCount(0);
  await expect(heading).toHaveCount(0);

  // Double-click edits a chip; Enter saves it.
  await page.getByRole("button", { name: "Blog", exact: true }).dblclick();
  const edit = page.getByLabel("Edit Blog");
  await edit.fill("home");
  await edit.press("Enter");
  await expect(page.getByRole("button", { name: "Remove home" })).toBeVisible();
  await expect(heading).toBeVisible();
});

test("action flows: add a trigger and an action, save, and see it after reload", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Section", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });

  await page.getByRole("tab", { name: /action/i }).click();
  await page.getByRole("button", { name: "Add action" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByText("Select Action Trigger")).toBeVisible();
  await modal.getByRole("button", { name: "Choose a trigger" }).click();
  await page.locator("[role=menuitem]", { hasText: /^On Click$/ }).click();
  await modal.getByRole("button", { name: "Add Action", exact: true }).click();
  await modal.getByLabel("Search actions").fill("toast");
  await modal.getByRole("button", { name: "Show Toast" }).click();
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal.getByText("Unsaved changes")).toBeHidden({ timeout: 10_000 });
  await modal.getByRole("button", { name: "Close the Action Flow Editor" }).click();

  const flows = page.getByRole("list", { name: "Action flows" });
  await expect(flows.getByText("On Click")).toBeVisible();
  await expect(flows.getByText("1 action")).toBeVisible();

  // The Navigator shows the element's actions and opens them.
  await page.getByRole("button", { name: /^Open the actions of/ }).click();
  await expect(modal.getByText("Show Toast")).toBeVisible();
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -300);
  // The wheel zooms the canvas.
  await expect(modal.getByText("100%")).toBeHidden();
  await modal.getByRole("button", { name: "Close the Action Flow Editor" }).click();

  await page.reload();
  await page.getByRole("treeitem").first().click();
  await page.getByRole("tab", { name: /action/i }).click();
  await expect(
    page.getByRole("list", { name: "Action flows" }).getByText("1 action")
  ).toBeVisible();
});

test("action runtime: a click opens the chosen modal with the passed parameter, Escape closes it", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await newModalTemplate(page);
  await editHome(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });

  // On Click > Show Modal: pick the template, then pass its parameter (required, so marked).
  await page.getByRole("tab", { name: /action/i }).click();
  await page.getByRole("button", { name: "Add action" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Choose a trigger" }).click();
  await page.locator("[role=menuitem]", { hasText: /^On Click$/ }).click();
  await modal.getByRole("button", { name: "Add Action", exact: true }).click();
  await modal.getByLabel("Search actions").fill("modal");
  await modal.getByRole("button", { name: "Show Modal" }).click();
  await expect(modal.getByText("Choose a template to see its parameters.")).toBeVisible();
  await modal.getByRole("button", { name: /^Modal template/ }).click();
  await page.locator("[role=option]", { hasText: "Main modal" }).click();
  await expect(modal.getByText("Required: pass a value.")).toBeVisible();
  await modal.getByRole("textbox", { name: /^title/ }).fill("Saved from a flow");
  await expect(modal.getByText("Required: pass a value.")).toHaveCount(0);
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal.getByText("Unsaved changes")).toBeHidden({ timeout: 10_000 });
  await modal.getByRole("button", { name: "Close the Action Flow Editor" }).click();

  // The preview runs the saved flow: the modal opens fixed over the page with the passed value.
  await page.goto(`/preview/${projectId}`);
  await page.locator("main button, body button").first().click();
  const layer = page.locator('[data-nx-overlay="modal"]');
  await expect(layer).toContainText("Saved from a flow");
  await expect(layer).toHaveCSS("position", "fixed");
  await page.keyboard.press("Escape");
  await expect(layer).toHaveCount(0);
});

test("action runtime: a bottom sheet sits at the bottom with its own overlay", async ({ page }) => {
  const projectId = await signUpAndCreateProject(page);
  await newModalTemplate(page, "Bottom Sheet");
  await editHome(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  await page.getByRole("tab", { name: /action/i }).click();
  await page.getByRole("button", { name: "Add action" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Choose a trigger" }).click();
  await page.locator("[role=menuitem]", { hasText: /^On Click$/ }).click();
  await modal.getByRole("button", { name: "Add Action", exact: true }).click();
  await modal.getByLabel("Search actions").fill("Show");
  await modal.getByRole("button", { name: "Show", exact: true }).click();
  await modal.getByRole("button", { name: /^Bottom sheet template/ }).click();
  await page.locator("[role=option]", { hasText: "Main bottom sheet" }).click();
  await modal.getByRole("textbox", { name: /^title/ }).fill("From a sheet");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal.getByText("Unsaved changes")).toBeHidden({ timeout: 10_000 });
  await modal.getByRole("button", { name: "Close the Action Flow Editor" }).click();

  await page.goto(`/preview/${projectId}`);
  await page.locator("main button, body button").first().click();
  const layer = page.locator('[data-nx-overlay="bottom-sheet"]');
  await expect(layer).toContainText("From a sheet");
  const sheet = layer.locator("[data-nx-overlay-content]");
  // It slides in first (300ms after a 100ms delay), then rests on the bottom edge.
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      const height = page.viewportSize()?.height ?? 0;
      return box ? Math.round(box.y + box.height - height) : null;
    })
    .toBe(0);
  // Clicking the overlay closes it.
  await page.mouse.click(5, 5);
  await expect(layer).toHaveCount(0);
});

test("action runtime: Add Class changes the clicked button", async ({ page }) => {
  const projectId = await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  await page.getByRole("tab", { name: /action/i }).click();
  await page.getByRole("button", { name: "Add action" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Choose a trigger" }).click();
  await page.locator("[role=menuitem]", { hasText: /^On Click$/ }).click();
  await modal.getByRole("button", { name: "Add Action", exact: true }).click();
  await modal.getByLabel("Search actions").fill("Add Class");
  await modal.getByRole("button", { name: "Add Class" }).click();
  await modal.getByRole("textbox", { name: /^Class/ }).fill("is-clicked");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal.getByText("Unsaved changes")).toBeHidden({ timeout: 10_000 });
  await modal.getByRole("button", { name: "Close the Action Flow Editor" }).click();

  await page.goto(`/preview/${projectId}`);
  const button = page.locator("main button, body button").first();
  await expect(button).not.toHaveClass(/is-clicked/);
  await button.click();
  await expect(button).toHaveClass(/is-clicked/);
});

test("flow editor Test runs the unsaved trigger on the canvas and lists each step", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Button", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  await page.getByRole("tab", { name: /action/i }).click();
  await page.getByRole("button", { name: "Add action" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Choose a trigger" }).click();
  await page.locator("[role=menuitem]", { hasText: /^On Click$/ }).click();
  await modal.getByRole("button", { name: "Add Action", exact: true }).click();
  await modal.getByLabel("Search actions").fill("toast");
  await modal.getByRole("button", { name: "Show Toast" }).click();

  // Test runs the unsaved flow and reports the failing step: a toast needs a title.
  await modal.getByRole("button", { name: "Test", exact: true }).click();
  const panel = page.getByRole("region", { name: "Test run" });
  await expect(panel.getByRole("list", { name: "Test steps" })).toContainText("Show Toast");
  await expect(panel.getByRole("alert")).toHaveText("Write the title of the toast.");
  await panel.getByRole("button", { name: "Back to editor" }).click();
  await expect(panel).toHaveCount(0);
  await expect(modal.getByText("Unsaved changes")).toBeVisible();

  // With a title, the native toast shows on the canvas.
  await modal.getByRole("textbox", { name: /^Title/ }).fill("Hello");
  await modal.getByRole("button", { name: "Test", exact: true }).click();
  await expect(panel.getByRole("status")).toHaveText("Finished");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nx-toast]")).toContainText("Hello");
});
