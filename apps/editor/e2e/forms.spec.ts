import { expect, test, type Page } from "@playwright/test";

// Forms group (7b-1): the tiles, the Form tag group, no nested forms, and a saved page that
// validates on blur and never submits on Enter.

async function signUpAndCreateProject(page: Page): Promise<string> {
  const email = `forms-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Forms Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Forms project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
  return page.url().split("/editor/")[1] ?? "";
}

// A click on a parent row folds it; select it and unfold again so the rows stay in view.
const selectRow = async (page: Page, text: string) => {
  const label = page
    .getByRole("tree", { name: "Page elements" })
    .getByText(text, { exact: true })
    .first();
  await label.click();
  const row = label.locator("xpath=ancestor::*[@role='treeitem']");
  if ((await row.getAttribute("aria-expanded")) === "false") await label.click();
};

const add = async (page: Page, tile: string) => {
  await page.getByRole("button", { name: "Add element" }).click();
  await page
    .getByRole("dialog", { name: "Elements" })
    .getByRole("button", { name: tile, exact: true })
    .click();
};

test("forms: tiles, tags, no nesting, blur validation and no submit on Enter", async ({ page }) => {
  const projectId = await signUpAndCreateProject(page);

  // The Forms group lists Form and Input.
  await page.getByRole("button", { name: "Add element" }).click();
  const flyout = page.getByRole("dialog", { name: "Elements" });
  await expect(flyout.getByRole("button", { name: "Form", exact: true })).toBeVisible();
  await expect(flyout.getByRole("button", { name: "Input", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // A form with an email input and a password input.
  await add(page, "Form");
  await add(page, "Input");
  // General settings are grouped under headings, with the default messages ready to edit.
  for (const heading of ["Field", "Content", "Validation", "Messages", "Behavior"])
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByLabel("Required message", { exact: true })).toHaveValue(
    "This field is required."
  );
  // The type list shows an icon beside every option and beside the chosen one.
  await page.getByRole("button", { name: /Type$/ }).click();
  for (const option of await page.locator("[role=option]").all())
    await expect(option.locator("svg").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Type$/ }).locator("svg").first()).toBeVisible();
  await page.getByLabel("Field name", { exact: true }).fill("email");
  await page.getByRole("button", { name: /Type$/ }).click();
  await page.locator("[role=option]", { hasText: /^email$/ }).click();
  await page.getByRole("switch", { name: "Required" }).click({ force: true });
  await add(page, "Input");
  await page.getByLabel("Field name", { exact: true }).fill("pw");
  await page.getByRole("button", { name: /Type$/ }).click();
  await page.locator("[role=option]", { hasText: /^password$/ }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(3);

  // A form cannot go inside a form: the form is selected, so the new one is refused.
  await selectRow(page, "Form");
  await add(page, "Form");
  await expect(page.getByText("A form cannot sit inside another form.")).toBeVisible();
  await expect(page.getByRole("treeitem")).toHaveCount(3);

  // The Form tag group offers the named fields of the active form.
  await page
    .getByRole("tree", { name: "Page elements" })
    .getByText("Input", { exact: true })
    .first()
    .click();
  await add(page, "Heading");
  await page.getByRole("button", { name: "Dynamic value for Text" }).click();
  await page
    .getByRole("group", { name: "Tag groups" })
    .getByRole("button", { name: "Form" })
    .click();
  await expect(page.getByText("form.form.email")).toBeVisible();
  await expect(page.getByText("form.form.pw")).toBeVisible();
  await page.keyboard.press("Escape");

  // Saved, the preview validates on blur and Enter never sends the values anywhere.
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const email = preview.locator('input[name="email"]');
  await email.fill("nope");
  await email.blur();
  await expect(
    preview.getByRole("alert").filter({ hasText: "Enter a valid email address." })
  ).toBeVisible();
  await email.fill("me@example.com");
  await expect(
    preview.getByRole("alert").filter({ hasText: "Enter a valid email address." })
  ).toBeHidden();
  const before = preview.url();
  const pw = preview.locator('input[name="pw"]');
  await pw.fill("hunter2-secret");
  await pw.press("Enter");
  expect(preview.url()).toBe(before);
  expect(preview.url()).not.toContain("hunter2");
});

const SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>';

test("form input design: Form Input group first, error style on canvas and preview, field icon", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);

  // A library with one icon, saved with the Design System.
  await page.getByRole("button", { name: "Design System" }).click();
  await page.getByRole("button", { name: /Fonts & Icons/ }).click();
  await page.getByRole("button", { name: "Icons", exact: true }).click();
  await page.getByRole("button", { name: "Upload icons" }).click();
  await page.getByRole("button", { name: "SVG icons" }).click();
  await page.getByLabel("Library name").fill("My Shapes");
  await page
    .getByTestId("icon-upload-input")
    .setInputFiles([
      { name: "square.svg", mimeType: "image/svg+xml", buffer: Buffer.from(SQUARE) }
    ]);
  await page.getByText("I have the right to use").click();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Installed icon libraries" })
      .getByRole("listitem")
      .filter({ hasText: "My Shapes" })
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close the Design System" }).click();

  await add(page, "Form");
  await add(page, "Input");
  await page.getByLabel("Field name", { exact: true }).fill("email");
  await page.getByRole("switch", { name: "Required" }).click({ force: true });

  // General > Icons: library, icon and position.
  await expect(page.getByRole("heading", { name: "Icons", exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: /Icon library$/ })
    .first()
    .click();
  await page.locator("[role=option]", { hasText: "My Shapes" }).click();
  await page.getByRole("button", { name: "Choose an icon" }).first().click();
  const picker = page.getByRole("dialog", { name: "Choose an icon" });
  await picker.getByLabel("Search icons").fill("squ");
  await picker.getByRole("button", { name: "square, my-shapes" }).click();
  await picker.getByRole("button", { name: "Use icon" }).click();
  await page.getByRole("button", { name: /Icon position$/ }).click();
  await page.locator("[role=option]", { hasText: "After" }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-icon] svg")).toBeVisible({ timeout: 15_000 });

  // Design tab: the Form Input group is the first one and holds the parts.
  await page.getByRole("tab", { name: /design/i }).click();
  const first = page.locator('[aria-label="Design settings"] > section').first();
  await expect(first).toHaveAttribute("data-accordion", "forminput");
  for (const part of ["Field", "Label", "Input box", "Input text", "Placeholder", "Field icon"])
    await expect(first.getByRole("button", { name: part, exact: true })).toBeVisible();
  for (const part of ["Clear button", "Help text", "Error message", "Success message"])
    await expect(first.getByRole("button", { name: part, exact: true })).toBeVisible();

  // Error state of the box: a red border, pinned on the canvas while it is edited.
  const box = first.locator('[data-input-part="box"]');
  await box.getByRole("button", { name: "Input box", exact: true }).click();
  await page.getByRole("button", { name: "State being edited" }).click();
  await page.locator("[role=option]", { hasText: "Error" }).click();
  await box.getByRole("button", { name: "Background and border" }).click();
  await box.getByLabel("Border color", { exact: true }).fill("rgb(255, 0, 0)");
  // Change dots: bright yellow on the state select and the part while Error is open.
  const stateSelect = page.locator('[aria-label="State being edited"]');
  await expect(stateSelect.locator(".select__trigger")).toHaveCSS(
    "background-color",
    "rgba(236, 72, 153, 0.2)"
  );
  await expect(stateSelect.locator('[data-dot="element-here"]')).toBeVisible();
  await expect(box.locator('[data-dot="element-here"]').first()).toBeVisible();
  const canvasBox = canvas.locator("[data-nxt-box]");
  await expect
    .poll(() => canvasBox.evaluate((el) => getComputedStyle(el).borderTopColor))
    .toBe("rgb(255, 0, 0)");
  // Back to Default, the canvas shows the normal look again (the error style is only pinned).
  await page.getByRole("button", { name: "State being edited" }).click();
  await page.locator("[role=option]", { hasText: "Default" }).click();
  await expect(stateSelect.locator('[data-dot="element-elsewhere"]')).toBeVisible();
  await expect
    .poll(() => canvasBox.evaluate((el) => getComputedStyle(el).borderTopColor))
    .not.toBe("rgb(255, 0, 0)");

  // Saved: the preview has the icon, the default border, and the red one only after an error.
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  await expect(preview.locator("[data-nxt-icon] svg")).toBeVisible();
  const previewBox = preview.locator("[data-nxt-box]");
  const border = () => previewBox.evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(await border()).toBe("rgb(212, 212, 216)");
  const email = preview.locator('input[name="email"]');
  await email.focus();
  await email.blur();
  await expect(
    preview.getByRole("alert").filter({ hasText: "This field is required." })
  ).toBeVisible();
  await expect.poll(border).toBe("rgb(255, 0, 0)");
});

test("checkbox: tile, form tag, required check validates and toggles in the preview", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Elements" })
      .getByRole("button", { name: "Checkbox", exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await add(page, "Form");
  await add(page, "Checkbox");
  await page.getByLabel("Field name", { exact: true }).fill("agree");
  await page.getByRole("switch", { name: "Must be checked" }).click({ force: true });
  await add(page, "Heading");
  await page.getByRole("button", { name: "Dynamic value for Text" }).click();
  await page
    .getByRole("group", { name: "Tag groups" })
    .getByRole("button", { name: "Form" })
    .click();
  await expect(page.getByText("form.form.agree")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const box = preview.locator('input[name="agree"]');
  const error = preview.getByRole("alert").filter({ hasText: "This field is required." });
  await box.check({ force: true });
  await expect(error).toBeHidden();
  await box.uncheck({ force: true });
  await box.blur();
  await expect(error).toBeVisible();
  await box.check({ force: true });
  await expect(error).toBeHidden();
});

test("option fields: starter options, placement, radio and checkbox group validate in the preview", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");

  // An option cannot sit loose in the form.
  await add(page, "Option");
  await expect(page.getByText(/option goes inside a Radio/)).toBeVisible();

  // Radio starts with three options and the Form tag group lists its field.
  await add(page, "Radio");
  await expect(page.getByRole("treeitem")).toHaveCount(5);
  await page.getByLabel("Field name", { exact: true }).fill("plan");
  await page.getByRole("switch", { name: "Required" }).click({ force: true });
  // A field of options takes only options, so each new element is added with the form selected.
  const selectForm = () =>
    page
      .getByRole("tree", { name: "Page elements" })
      .getByText("Form", { exact: true })
      .first()
      .click();
  await selectForm();
  await add(page, "Checkbox group");
  await page.getByLabel("Field name", { exact: true }).fill("toppings");
  await page.getByLabel("Fewest chosen", { exact: true }).fill("2");
  await selectForm();
  await add(page, "Choice chips");
  await page.getByLabel("Field name", { exact: true }).fill("tags");
  await selectForm();
  await add(page, "Heading");
  await page.getByRole("button", { name: "Dynamic value for Text" }).click();
  await page
    .getByRole("group", { name: "Tag groups" })
    .getByRole("button", { name: "Form" })
    .click();
  for (const tag of ["form.form.plan", "form.form.toppings", "form.form.tags"])
    await expect(page.getByText(tag)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);

  // Radio: leaving it unchosen shows the required message; choosing clears it.
  const radios = preview.locator('input[name="plan"]');
  await expect(radios).toHaveCount(3);
  const required = preview.getByRole("alert").filter({ hasText: "This field is required." });
  await radios.first().focus();
  await preview.locator('input[name="toppings"]').first().focus();
  await expect(required).toBeVisible();
  await radios.nth(1).check({ force: true });
  await expect(required).toBeHidden();
  // Moving between the radios of one group never counts as leaving it.
  await radios.nth(1).focus();
  await radios.nth(2).focus();
  await expect(required).toBeHidden();

  // Checkbox group: two must be chosen.
  const boxes = preview.locator('input[name="toppings"]');
  await boxes.nth(0).check({ force: true });
  await boxes.nth(0).blur();
  await preview.locator('input[name="plan"]').first().focus();
  await expect(preview.getByRole("alert").filter({ hasText: "Choose at least 2." })).toBeVisible();
  await boxes.nth(1).check({ force: true });
  await expect(preview.getByRole("alert").filter({ hasText: "Choose at least 2." })).toBeHidden();
});

test("dynamic options: one locked template option, ghost copies on the canvas, value type error", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "Radio");
  await expect(page.getByRole("treeitem")).toHaveCount(5);

  // The value data type flags a written option value that does not fit.
  await page.getByLabel("Value data type", { exact: true }).click();
  await page.locator("[role=option]", { hasText: "Int" }).first().click();
  await page.getByRole("treeitem").nth(3).click();
  await page.getByRole("textbox", { name: "Value" }).fill("abc");
  await expect(page.getByRole("alert").filter({ hasText: /whole number/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Value" }).fill("12");
  await expect(page.getByRole("alert").filter({ hasText: /whole number/ })).toBeHidden();

  // Dynamic Query keeps one option and shows the ghost copies.
  await selectRow(page, "Radio");
  await page.locator('button[aria-label="Options"]').click();
  await page.locator("[role=option]", { hasText: "Dynamic Query" }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(3);
  await expect(page.getByLabel("Open the query loop of Radio")).toBeVisible();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-ghost]")).toHaveCount(5, { timeout: 15_000 });

  // The template cannot be removed.
  await page.getByRole("treeitem").nth(2).click();
  await page.keyboard.press("Delete");
  await expect(page.getByText(/template of a field/)).toBeVisible();
  await expect(page.getByRole("treeitem")).toHaveCount(3);
});

test("pin: one box per character, typing, Backspace, paste and the incomplete message", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "PIN / OTP");
  await page.getByLabel("Field name", { exact: true }).fill("otp");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-cell]")).toHaveCount(6, { timeout: 15_000 });

  // Design tab: the Form PIN group holds the boxes, and a box has a Filled state.
  await page.getByRole("tab", { name: /design/i }).click();
  const group = page.locator('[aria-label="Design settings"] > section').first();
  for (const part of ["Field", "Label", "Boxes row", "Box", "Placeholder", "Error message"])
    await expect(group.getByRole("button", { name: part, exact: true })).toBeVisible();
  await group.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "State being edited" }).click();
  await expect(page.locator("[role=option]", { hasText: "Filled" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const cells = preview.locator("[data-nxt-cell]");
  const values = async () =>
    cells.evaluateAll((all) => all.map((c) => (c as HTMLInputElement).value));
  await expect(cells).toHaveCount(6);

  // A letter is refused, digits move on, Backspace on an empty box clears the one before.
  await cells.first().click();
  await preview.keyboard.type("12a3");
  expect(await values()).toEqual(["1", "2", "3", "", "", ""]);
  await preview.keyboard.press("Backspace");
  expect(await values()).toEqual(["1", "2", "", "", "", ""]);

  // Leaving a partly filled code shows the incomplete message; a pasted code fills every box.
  await cells.nth(2).blur();
  const incomplete = preview.getByRole("alert").filter({ hasText: "Enter the full code." });
  await expect(incomplete).toBeVisible();
  await cells.first().evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text", "654 321");
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
    );
  });
  expect(await values()).toEqual(["6", "5", "4", "3", "2", "1"]);
  await expect(incomplete).toBeHidden();
});

test("count controller: limits, buttons, keys, a typed tag and the Form Counter design", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "Count Controller");
  await page.getByLabel("Field name", { exact: true }).fill("qty");
  await page.getByRole("textbox", { name: "Initial count" }).fill("1");
  await page.getByRole("textbox", { name: "Minimum" }).fill("0");
  await page.getByRole("textbox", { name: "Maximum" }).fill("3");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-count]")).toHaveValue("1", { timeout: 15_000 });

  await page.getByRole("tab", { name: /design/i }).click();
  const group = page.locator('[aria-label="Design settings"] > section').first();
  for (const part of ["Field", "Counter box", "Decrease button", "Increase button", "Count"])
    await expect(group.getByRole("button", { name: part, exact: true })).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const count = preview.locator("[data-nxt-count]");
  const up = preview.getByRole("button", { name: "Increase" });
  const down = preview.getByRole("button", { name: "Decrease" });
  await expect(count).toHaveValue("1");
  await up.click();
  await up.click();
  await expect(count).toHaveValue("3");
  await expect(up).toBeDisabled();
  await down.click();
  await expect(count).toHaveValue("2");
  await count.focus();
  await preview.keyboard.press("Home");
  await expect(count).toHaveValue("0");
  await expect(down).toBeDisabled();
  await preview.keyboard.press("ArrowUp");
  await expect(count).toHaveValue("1");
  await expect(count).toHaveAttribute("aria-valuenow", "1");
});

test("range slider: drag fill and value, keys and the Form Range design", async ({ page }) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "Range Slider");
  await page.getByRole("textbox", { name: "Initial value" }).fill("20");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-thumb]")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("tab", { name: /design/i }).click();
  const group = page.locator('[aria-label="Design settings"] > section').first();
  for (const part of ["Slider row", "Track", "Filled part", "Thumb", "Value"])
    await expect(group.getByRole("button", { name: part, exact: true })).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const input = preview.locator('input[type="range"]');
  const value = preview.locator("[data-nxt-value]");
  await expect(input).toHaveValue("20");
  await expect(value).toHaveText("20");
  await input.focus();
  await preview.keyboard.press("ArrowRight");
  await preview.keyboard.press("ArrowRight");
  await expect(value).toHaveText("22");
  await preview.keyboard.press("End");
  await expect(value).toHaveText("100");
  const p = await preview
    .locator("[data-nxt-range]")
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue("--nxt-p"));
  expect(Number(p)).toBe(1);
  const fill = await preview.locator("[data-nxt-fill]").boundingBox();
  const track = await preview.locator("[data-nxt-track]").boundingBox();
  // The fill ends under the centre of the thumb: the track minus half the 20px thumb.
  expect(fill && track && Math.abs(track.width - fill.width - 10) < 2).toBe(true);
});

test("date picker: open, pick, keys, limits, clear and the Form Date and Time design", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "Date and Time");
  await page.getByLabel("Field name", { exact: true }).fill("when");
  await page.getByRole("textbox", { name: "Default value" }).fill("2026-11-18");
  await page.getByRole("textbox", { name: "Earliest" }).fill("2026-11-10");
  await page.getByRole("textbox", { name: "Latest" }).fill("2026-11-25");
  // A selected field shows its popover open so the calendar parts can be designed.
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-popover]")).toBeVisible({ timeout: 15_000 });
  await expect(canvas.locator("[data-nxt-day]")).toHaveCount(42);

  await page.getByRole("tab", { name: /design/i }).click();
  const group = page.locator('[aria-label="Design settings"] > section').first();
  for (const part of ["Popover", "Day", "Today", "Month buttons", "Time choice"])
    await expect(group.getByRole("button", { name: part, exact: true })).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const control = preview.locator('input[type="hidden"][data-nxt-control]');
  const trigger = preview.locator("[data-nxt-trigger]");
  const popover = preview.locator("[data-nxt-popover]");
  await expect(control).toHaveValue("2026-11-18");
  await expect(popover).toBeHidden();

  // Open with the keyboard: focus lands on the chosen day; one tab stop in the grid.
  await trigger.focus();
  await preview.keyboard.press("Enter");
  await expect(popover).toBeVisible();
  const chosen = preview.locator('[data-nxt-day][data-date="2026-11-18"]');
  await expect(chosen).toBeFocused();
  await expect(preview.locator('[data-nxt-day][tabindex="0"]')).toHaveCount(1);
  await expect(preview.locator("[data-nxt-title]")).toHaveText(/November 2026/);

  // Limits: days outside them cannot be chosen and the previous month button is off.
  const early = preview.locator('[data-nxt-day][data-date="2026-11-09"]');
  await expect(early).toHaveAttribute("aria-disabled", "true");
  await early.click({ force: true });
  await expect(control).toHaveValue("2026-11-18");
  await expect(preview.locator('[data-nxt-nav="-1"]')).toBeDisabled();
  // The click above moved the focus onto that day; put it back on the chosen one.
  await chosen.focus();

  // Arrow keys move the focus. A day past the limit takes focus but Enter does not choose it.
  await preview.keyboard.press("ArrowRight");
  await expect(preview.locator('[data-nxt-day][data-date="2026-11-19"]')).toBeFocused();
  await preview.keyboard.press("ArrowDown");
  await expect(preview.locator('[data-nxt-day][data-date="2026-11-26"]')).toBeFocused();
  await preview.keyboard.press("Enter");
  await expect(control).toHaveValue("2026-11-18");
  await expect(popover).toBeVisible();
  // Enter on a day in range chooses it, closes the popover and gives focus back to the field.
  await preview.keyboard.press("ArrowUp");
  await preview.keyboard.press("Enter");
  await expect(control).toHaveValue("2026-11-19");
  await expect(popover).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).not.toHaveAttribute("data-empty", "");

  // Page Down moves a month, Escape closes without choosing.
  await preview.keyboard.press("Enter");
  await expect(popover).toBeVisible();
  await preview.keyboard.press("PageDown");
  await expect(preview.locator("[data-nxt-title]")).toHaveText(/December 2026/);
  await preview.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(control).toHaveValue("2026-11-19");

  // A click on a day chooses it; a click outside closes the popover; Clear empties the field.
  await trigger.click();
  await preview.locator('[data-nxt-day][data-date="2026-11-12"]').click();
  await expect(control).toHaveValue("2026-11-12");
  await trigger.click();
  await expect(popover).toBeVisible();
  // The label sits at that spot: pressing it closes the popover and must not open it again.
  await preview.mouse.click(5, 5);
  await expect(popover).toBeHidden();
  await preview.locator("[data-nxt-clear]").click();
  await expect(control).toHaveValue("");
  await expect(trigger).toHaveAttribute("data-empty", "");
});

test("date picker: a time of day with a minute step, 24-hour clock and the Today button", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "Date and Time");
  await page.getByRole("button", { name: /Picks/ }).click();
  await page.getByRole("option", { name: "A time", exact: true }).click();
  await page.getByRole("button", { name: /Clock/ }).click();
  await page.locator("[role=option]", { hasText: "24-hour" }).click();
  await page.getByRole("button", { name: /Minute step/ }).click();
  await page.locator("[role=option]", { hasText: "15 min" }).click();
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator('[data-nxt-time="minute"]')).toHaveCount(4, { timeout: 15_000 });
  await expect(canvas.locator("[data-nxt-calendar]")).toHaveCount(0);

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const control = preview.locator('input[type="hidden"][data-nxt-control]');
  await preview.locator("[data-nxt-trigger]").click();
  await preview.locator('[data-nxt-time="hour"][data-v="14"]').click();
  await expect(control).toHaveValue(/^14:\d{2}$/);
  await preview.locator('[data-nxt-time="minute"][data-v="45"]').click();
  await expect(control).toHaveValue("14:45");
  await expect(preview.locator("[data-nxt-trigger]")).toHaveText("14:45");
  await expect(preview.locator('[data-nxt-time="hour"][data-v="14"]')).toHaveAttribute(
    "aria-selected",
    "true"
  );
  // The chosen time is drawn as chosen (the built-in look puts a filled background on it).
  await expect(preview.locator('[data-nxt-time="hour"][data-v="14"]')).toHaveCSS(
    "background-color",
    "rgb(99, 102, 241)"
  );
  // Arrow keys move inside a list; the Now button puts the time on the step nearest below.
  await preview.locator('[data-nxt-time="minute"][data-v="45"]').focus();
  await preview.keyboard.press("ArrowUp");
  await expect(preview.locator('[data-nxt-time="minute"][data-v="30"]')).toBeFocused();
  await preview.locator("[data-nxt-today-btn]").click();
  await expect(control).toHaveValue(/^\d{2}:(00|15|30|45)$/);
  await preview.locator("[data-nxt-done]").click();
  await expect(preview.locator("[data-nxt-popover]")).toBeHidden();
});

test("select: panel on the canvas, search, keys and one choice in the preview", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "Select");
  await page.getByLabel("Field name", { exact: true }).fill("plan");
  // A selected Select (or one of its options) shows its panel open so the options can be designed.
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-popover]")).toBeVisible({ timeout: 15_000 });
  await expect(canvas.locator('[role="option"]')).toHaveCount(3);

  await page.getByRole("tab", { name: /design/i }).click();
  const group = page.locator('[aria-label="Design settings"] > section').first();
  for (const part of ["Dropdown panel", "Search box", "Option item", "Chip", "No results message"])
    await expect(group.getByRole("button", { name: part, exact: true })).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const trigger = preview.locator("[data-nxt-trigger]");
  const popover = preview.locator("[data-nxt-popover]");
  const picked = preview.locator("input[data-nxt-control]:checked");
  await expect(trigger).toHaveAttribute("data-empty", "");
  await expect(popover).toBeHidden();

  // Open with the keyboard: the search box takes the focus and every option shows.
  await trigger.focus();
  await preview.keyboard.press("Enter");
  await expect(popover).toBeVisible();
  const search = preview.locator("[data-nxt-search]");
  await expect(search).toBeFocused();
  await expect(preview.locator('[role="option"]:not([hidden])')).toHaveCount(3);

  // Typing narrows the list (every word must match); no match shows the empty message.
  await search.fill("option 3");
  await expect(preview.locator('[role="option"]:not([hidden])')).toHaveCount(1);
  await search.fill("nothing like it");
  await expect(preview.locator("[data-nxt-empty]")).toBeVisible();
  await search.fill("OPTION 2");
  await expect(preview.locator('[role="option"]:not([hidden])')).toHaveText(/Option 2/);
  // Enter chooses the active row, closes the panel and gives focus back to the field.
  await preview.keyboard.press("Enter");
  await expect(popover).toBeHidden();
  await expect(picked).toHaveValue("option2");
  await expect(trigger).toHaveText("Option 2");
  await expect(trigger).toBeFocused();
  await expect(trigger).not.toHaveAttribute("data-empty", "");

  // Arrow keys move the active row; Escape closes without choosing.
  await preview.keyboard.press("ArrowDown");
  await expect(popover).toBeVisible();
  await expect(preview.locator('[role="option"][data-active]')).toHaveText(/Option 2/);
  await preview.keyboard.press("ArrowDown");
  await expect(preview.locator('[role="option"][data-active]')).toHaveText(/Option 3/);
  await preview.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(picked).toHaveValue("option2");

  // A click on a row chooses it; the Clear button empties the field.
  await trigger.click();
  await preview.getByRole("option", { name: "Option 1" }).click();
  await expect(picked).toHaveValue("option1");
  await expect(trigger).toHaveText("Option 1");
  await preview.locator("[data-nxt-clear]").click();
  await expect(picked).toHaveCount(0);
  await expect(trigger).toHaveAttribute("data-empty", "");
});

test("select: several choices as chips, kept open, removed again", async ({ page }) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Form");
  await add(page, "Select");
  await page.getByLabel("Field name", { exact: true }).fill("tags");
  await page.getByRole("switch", { name: "Choose several" }).click({ force: true });
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${projectId}`);
  const trigger = preview.locator("[data-nxt-trigger]");
  const popover = preview.locator("[data-nxt-popover]");
  const picked = preview.locator("input[data-nxt-control]:checked");

  await trigger.click();
  await preview.getByRole("option", { name: "Option 1" }).click();
  await preview.getByRole("option", { name: "Option 3" }).click();
  // The panel stays open while choosing; each choice is a chip and the rows say what is chosen.
  await expect(popover).toBeVisible();
  await expect(picked).toHaveCount(2);
  await expect(preview.locator("[data-nxt-chip]")).toHaveCount(2);
  await expect(preview.getByRole("option", { name: "Option 1" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  // A chosen row is chosen again to remove it.
  await preview.getByRole("option", { name: "Option 1" }).click();
  await expect(picked).toHaveCount(1);
  await expect(preview.locator("[data-nxt-chip]")).toHaveText(/Option 3/);
  await preview.keyboard.press("Escape");
  await expect(popover).toBeHidden();

  // The chip's x removes it; Backspace on the field removes the last one.
  await trigger.click();
  await preview.getByRole("option", { name: "Option 2" }).click();
  await preview.keyboard.press("Escape");
  await expect(preview.locator("[data-nxt-chip]")).toHaveCount(2);
  await preview.locator("[data-nxt-chip-x]").first().click();
  await expect(picked).toHaveCount(1);
  await trigger.focus();
  await preview.keyboard.press("Backspace");
  await expect(picked).toHaveCount(0);
  await expect(trigger).toHaveAttribute("data-empty", "");
});
