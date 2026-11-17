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
  await page
    .getByRole("tree", { name: "Page elements" })
    .getByText("Form", { exact: true })
    .click();
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
  await page.locator("[role=option]", { hasText: "Right" }).click();
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
  await box.getByRole("tab", { name: "Error" }).click();
  await box.getByLabel("Border color", { exact: true }).fill("rgb(255, 0, 0)");
  const canvasBox = canvas.locator("[data-nxt-box]");
  await expect
    .poll(() => canvasBox.evaluate((el) => getComputedStyle(el).borderTopColor))
    .toBe("rgb(255, 0, 0)");
  // Back to Default, the canvas shows the normal look again (the error style is only pinned).
  await box.getByRole("tab", { name: "Default" }).click();
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
