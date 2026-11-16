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
