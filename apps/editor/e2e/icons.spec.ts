import { expect, test, type Page } from "@playwright/test";

// Design System > Fonts & Icons > Icons: install a catalog set (SVG Spinners, the smallest animated
// set), see it in Installed with its chips, keep it across a reload, turn it off, and remove it.
// The install downloads from jsDelivr, so this needs network access like the font tests do.

async function openIcons(page: Page) {
  const email = `icons-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Icons Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Icons project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
  await openIconsTab(page);
}

async function openIconsTab(page: Page) {
  await page.getByRole("button", { name: "Design System" }).click();
  await page.getByRole("button", { name: /Fonts & Icons/ }).click();
  await page.getByRole("button", { name: "Icons", exact: true }).click();
  await expect(page.getByRole("region", { name: "Icon sets" })).toBeVisible();
}

test("install an animated icon set, keep it, toggle it and remove it", async ({ page }) => {
  await openIcons(page);
  const catalog = page.getByRole("region", { name: "Icon sets" });
  const installed = page.getByRole("region", { name: "Installed icon libraries" });

  // The catalog lists the set with its license and the install button.
  await page.getByLabel("Search icon sets").fill("spinners");
  const row = catalog.getByRole("listitem").filter({ hasText: "SVG Spinners" });
  await expect(row).toContainText("MIT");
  await expect(row.getByText("Animated")).toBeVisible();
  await expect(installed).toContainText("No icon libraries yet");

  await row.getByRole("button", { name: "Install" }).click();
  const mine = installed.getByRole("listitem").filter({ hasText: "SVG Spinners" });
  await expect(mine).toBeVisible({ timeout: 60_000 });
  await expect(mine.getByText("Animated")).toBeVisible();
  await expect(mine.getByText(/\d+ icons/)).toBeVisible();
  // An installed set leaves the catalog list.
  await expect(catalog.getByRole("listitem").filter({ hasText: "SVG Spinners" })).toHaveCount(0);
  // Its preview icons are drawn as SVG.
  await expect(mine.locator("svg").first()).toBeVisible();

  // Icon changes are a draft until the Design System Save; after it the set survives a reload.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.reload();
  await openIconsTab(page);
  await expect(
    page
      .getByRole("region", { name: "Installed icon libraries" })
      .getByRole("listitem")
      .filter({ hasText: "SVG Spinners" })
  ).toBeVisible();

  // Turn it off in the picker, then remove it (a draft until Save).
  const again = page
    .getByRole("region", { name: "Installed icon libraries" })
    .getByRole("listitem")
    .filter({ hasText: "SVG Spinners" });
  await again.getByRole("switch", { name: /Show SVG Spinners/ }).click({ force: true });
  await again.getByRole("button", { name: "Remove SVG Spinners" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("region", { name: "Installed icon libraries" })).toContainText(
    "No icon libraries yet"
  );
  // It is back in the catalog, ready to install again.
  await page.getByLabel("Search icon sets").fill("spinners");
  await expect(
    page
      .getByRole("region", { name: "Icon sets" })
      .getByRole("listitem")
      .filter({ hasText: "SVG Spinners" })
  ).toBeVisible();
});

test("a set over the install limit says so instead of installing", async ({ page }) => {
  await openIcons(page);
  await page.getByLabel("Search icon sets").fill("fluent emoji");
  const row = page
    .getByRole("region", { name: "Icon sets" })
    .getByRole("listitem")
    .filter({ hasText: /^Fluent Emoji(?! Flat)/ });
  await expect(row.getByRole("button", { name: "Too large" })).toBeDisabled();
});
