import { expect, test, type Page } from "@playwright/test";

// Profile image and the account menu.

test.use({ actionTimeout: 15_000 });

async function signUp(page: Page, name: string): Promise<string> {
  const email = `settings-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  "base64"
);

test("profile image, first letter fallback and the account menu", async ({ page }) => {
  const email = await signUp(page, "zara Quinn");
  const menu = page.getByRole("button", { name: "Account menu" });
  await expect(menu).toContainText("Z");
  await menu.click();
  await expect(page.getByRole("menu", { name: "Account" })).toContainText("zara Quinn");
  await expect(page.getByRole("menu", { name: "Account" })).toContainText(email);
  await page
    .getByRole("menu", { name: "Account" })
    .getByRole("menuitem", { name: "Settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings/);

  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  // A member does not see the email settings.
  await expect(page.getByRole("heading", { name: "Email", exact: true })).toHaveCount(0);

  await page
    .getByLabel("Profile image file")
    .setInputFiles({ name: "a.svg", mimeType: "image/png", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Use a PNG, JPG, WebP or GIF image.")).toBeVisible();

  await page
    .getByLabel("Profile image file")
    .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(page.getByRole("button", { name: "Change image" })).toBeVisible();
  const src = await page.locator('header img[src^="/avatars/"]').getAttribute("src");
  expect(src).toMatch(/^\/avatars\/[^/]+\/[a-f0-9]{24}\.png$/);
  const served = await page.request.get(src ?? "");
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: "Upload image" })).toBeVisible();
  await expect(page.locator('header img[src^="/avatars/"]')).toHaveCount(0);
});
