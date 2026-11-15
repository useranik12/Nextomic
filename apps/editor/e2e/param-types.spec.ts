import { expect, test } from "@playwright/test";

// Page parameters offer Color and Icon, each with a default-value control that fits the type.

test("a page parameter can be a color or an icon", async ({ page }) => {
  const email = `param-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Param Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Param types project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);

  await page.getByRole("button", { name: "Edit Page Parameters" }).click();
  await page.getByRole("button", { name: "Add parameter" }).click();

  await page.getByRole("button", { name: "Parameter type" }).click();
  await expect(page.getByRole("option", { name: "Color" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Icon" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Page", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Color" }).click();
  await expect(
    page.getByRole("button", { name: "Open the color picker for Default value for param1" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Parameter type" }).click();
  await page.getByRole("option", { name: "Icon" }).click();
  await expect(
    page.getByRole("button", { name: "Choose an icon for Default value for param1" })
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Default value for param1" }).fill("ph:star");
  await page.getByRole("button", { name: "Save Page Parameters" }).click();
  await expect(page.getByText("= ph:star")).toBeVisible();
});
