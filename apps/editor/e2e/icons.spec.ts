import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

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

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script><path onclick="x()" d="M0 0h24v24H0z"/></svg>';
const WOFF2 = Buffer.from([0x77, 0x4f, 0x46, 0x32, ...new Array(60).fill(1)]);
const SELECTION = JSON.stringify({
  icons: [
    { properties: { name: "home", code: 59648 } },
    { properties: { name: "star", code: 59649 } }
  ]
});

test("upload SVG files and an icon font as custom libraries", async ({ page }) => {
  await openIcons(page);
  const installed = page.getByRole("region", { name: "Installed icon libraries" });

  // SVG files: sanitized into icons, listed as a custom library.
  await page.getByRole("button", { name: "Upload icons" }).click();
  await page.getByRole("button", { name: "SVG icons" }).click();
  await page.getByLabel("Library name").fill("My Shapes");
  await page.getByTestId("icon-upload-input").setInputFiles([
    { name: "Square.svg", mimeType: "image/svg+xml", buffer: Buffer.from(SVG) },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") }
  ]);
  await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeDisabled();
  await page.getByText("I have the right to use").click();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  // One file was left out, so the dialog tells us instead of closing silently.
  await expect(page.getByText("notes.txt: not an SVG file")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Done" }).click();
  const shapes = installed.getByRole("listitem").filter({ hasText: "My Shapes" });
  await expect(shapes).toContainText("1 icons");
  await expect(shapes.getByText("Custom")).toBeVisible();
  await expect(shapes.locator("svg").first()).toBeVisible();
  // The script and the handler never reach the stored icon.
  expect(await shapes.innerHTML()).not.toMatch(/alert|onclick/);

  // Icon font: font file plus selection.json.
  await page.getByRole("button", { name: "Upload icons" }).click();
  await page.getByLabel("Library name").fill("Brand Font");
  await page.getByTestId("icon-upload-input").setInputFiles([
    { name: "brand.woff2", mimeType: "font/woff2", buffer: WOFF2 },
    { name: "selection.json", mimeType: "application/json", buffer: Buffer.from(SELECTION) }
  ]);
  await page.getByText("I have the right to use").click();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const font = installed.getByRole("listitem").filter({ hasText: "Brand Font" });
  await expect(font).toContainText("2 icons", { timeout: 30_000 });
  await expect(font.getByText("Icon font")).toBeVisible();

  // The font file is served from the project's icon route with safe headers.
  const href = await page.evaluate(() =>
    [...document.querySelectorAll("style")]
      .map((s) => /url\(([^)]*\.woff2)\)/.exec(s.textContent ?? "")?.[1])
      .find(Boolean)
  );
  const res = await page.request.get(href ?? "/missing");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("font/woff2");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  // The library's JSON data is not public.
  const json = href?.replace(/\.woff2$/, ".json") ?? "/missing";
  expect((await page.request.get(json)).status()).toBe(404);
});

test("an icon font upload explains what is missing", async ({ page }) => {
  await openIcons(page);
  await page.getByRole("button", { name: "Upload icons" }).click();
  await expect(page.getByText("How to create or upload an icon font")).toBeVisible();
  await page.getByLabel("Library name").fill("Lonely Font");
  await page
    .getByTestId("icon-upload-input")
    .setInputFiles([{ name: "x.woff2", mimeType: "font/woff2", buffer: WOFF2 }]);
  await page.getByText("I have the right to use").click();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(
    page.getByText("Add the file that lists the icons", { exact: false }).last()
  ).toBeVisible();
});

test("upload an IcoMoon style zip as an icon font", async ({ page }) => {
  await openIcons(page);
  const zip = zipSync({
    "fonts/brand.woff2": new Uint8Array(WOFF2),
    "selection.json": strToU8(SELECTION),
    "demo.html": strToU8("<html></html>")
  });
  await page.getByRole("button", { name: "Upload icons" }).click();
  await page.getByLabel("Library name").fill("Zip Font");
  await page
    .getByTestId("icon-upload-input")
    .setInputFiles([
      { name: "icomoon.zip", mimeType: "application/zip", buffer: Buffer.from(zip) }
    ]);
  await page.getByText("I have the right to use").click();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const font = page
    .getByRole("region", { name: "Installed icon libraries" })
    .getByRole("listitem")
    .filter({ hasText: "Zip Font" });
  await expect(font).toContainText("2 icons", { timeout: 30_000 });
  await expect(font.getByText("Icon font")).toBeVisible();
});
