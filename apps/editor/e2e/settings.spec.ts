import { expect, test, type Page } from "@playwright/test";

// Profile image and the account menu.

test.use({ actionTimeout: 15_000 });

async function signUp(page: Page, name: string): Promise<string> {
  const email = `settings-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
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
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  // A member does not see the email settings.
  await expect(page.getByRole("heading", { name: "Email", exact: true })).toHaveCount(0);

  // Under load the file can be set before the page hydrates and the change is lost; pick it again
  // until the form turns dirty (Save shows).
  await expect(async () => {
    await page
      .getByLabel("Profile image file")
      .setInputFiles({ name: "a.svg", mimeType: "image/png", buffer: Buffer.from("<svg/>") });
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible({
      timeout: 1_000
    });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Use a PNG, JPG, WebP or GIF image.")).toBeVisible();

  await page
    .getByLabel("Profile image file")
    .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG_1PX });
  // Nothing is stored until Save.
  await expect(page.locator('header img[src^="/avatars/"]')).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("Zara Quinn");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change image" })).toBeVisible();
  const src = await page.locator('header img[src^="/avatars/"]').getAttribute("src");
  expect(src).toMatch(/^\/avatars\/[^/]+\/[a-f0-9]{24}\.png$/);
  const served = await page.request.get(src ?? "");
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: "Upload image" })).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("button", { name: "Change image" })).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.locator('header img[src^="/avatars/"]')).toHaveCount(0);
});

test("security settings show password, two-factor and passkeys", async ({ page }) => {
  await signUp(page, "Sam Lee");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
  await expect(page.getByText("Two-factor authentication")).toBeVisible();
  await expect(page.getByText("No passkeys yet.")).toBeVisible();
  await page.getByRole("button", { name: "Turn on" }).click();
  await page.getByLabel("Confirm your password").fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByAltText("QR code for your authenticator app")).toBeVisible();
});

test("sign-in button recovers after an error; remember me and magic link exist", async ({
  page
}) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("checkbox", { name: "Remember me" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Email me a link" })).toBeVisible();
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await submit.click();
  await expect(page.getByText(/invalid/i)).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-2");
  await expect(submit).toBeEnabled();
  await expect(page.getByText(/invalid/i)).toHaveCount(0);
});

test("signed-in users are sent away from auth pages; error pages link to the dashboard", async ({
  page
}) => {
  await signUp(page, "Robin Ash");
  for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/two-factor"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard/);
  }
  await page.goto("/editor/does-not-exist");
  await page.getByText("Go to dashboard").click();
  await expect(page).toHaveURL(/\/dashboard/);
});
