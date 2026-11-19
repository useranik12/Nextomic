import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// App Settings > Media: uploaded images are shrunk to WebP in the browser, at the chosen quality,
// and left alone when the switch is off.

async function openProject(page: Page) {
  const email = `compress-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Compress Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Compress project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

/** A photo-like PNG: smooth gradients with a little noise, far bigger as PNG than as WebP. */
async function photoPng(): Promise<Buffer> {
  const width = 600;
  const height = 400;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const noise = (x * 7 + y * 13) % 11;
      raw[i] = (x / width) * 255 + noise;
      raw[i + 1] = (y / height) * 255 + noise;
      raw[i + 2] = 128 + noise;
    }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

async function uploadAndRead(page: Page, name: string, buffer: Buffer) {
  await page.getByTestId("media-file-input").setInputFiles({ name, mimeType: "image/png", buffer });
  const base = name.replace(/\.png$/, "");
  await page.getByRole("button", { name: `Open ${base}` }).click();
  const path = (await page.locator("dd", { hasText: /^\/media\// }).textContent()) ?? "";
  const res = await page.request.get(path);
  return { path, type: res.headers()["content-type"], size: (await res.body()).length };
}

test("images are shrunk to WebP by default, and the quality steps and switch are saved", async ({
  page
}) => {
  await openProject(page);
  const png = await photoPng();

  await page.getByRole("button", { name: "App Settings" }).click();
  await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
  const compress = page.getByRole("switch", { name: "Compress uploaded images" });
  await expect(compress).toBeChecked();
  await expect(page.getByRole("radio", { name: "60%" })).toBeChecked();
  await page.getByRole("radio", { name: "40%" }).click();
  await expect(page.getByRole("radio", { name: "40%" })).toBeChecked();

  await page.getByRole("button", { name: "Media", exact: true }).click();
  const shrunk = await uploadAndRead(page, "photo.png", png);
  expect(shrunk.type).toBe("image/webp");
  expect(shrunk.size).toBeLessThan(png.length / 3);

  await page.getByRole("button", { name: "App Settings" }).click();
  await compress.click({ force: true });
  await expect(compress).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "40%" })).toBeDisabled();

  await page.getByRole("button", { name: "Media", exact: true }).click();
  const kept = await uploadAndRead(page, "plain.png", png);
  expect(kept.type).toBe("image/png");
  expect(kept.size).toBe(png.length);
});
