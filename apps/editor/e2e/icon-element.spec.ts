import { expect, test } from "@playwright/test";

// The Icon element: pick an icon from a project library, see it on the canvas, and be stopped from
// removing a library whose icons are in use. Uses an uploaded SVG library, so it needs no network.

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>';

test("pick a library icon, draw it on the canvas, and keep its library while in use", async ({
  page
}) => {
  const email = `icon-el-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Icon Element Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Icon element project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);

  // A custom library with one icon, saved with the Design System.
  const openIcons = async () => {
    await page.getByRole("button", { name: "Design System" }).click();
    await page.getByRole("button", { name: /Fonts & Icons/ }).click();
    await page.getByRole("button", { name: "Icons", exact: true }).click();
  };
  await openIcons();
  await page.getByRole("button", { name: "Upload icons" }).click();
  await page.getByRole("button", { name: "SVG icons" }).click();
  await page.getByLabel("Library name").fill("My Shapes");
  await page
    .getByTestId("icon-upload-input")
    .setInputFiles([{ name: "square.svg", mimeType: "image/svg+xml", buffer: Buffer.from(SVG) }]);
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

  // Add an Icon element and pick the icon.
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Icon", exact: true }).click();
  await page.getByRole("button", { name: /Icon library$/ }).click();
  await page.locator("[role=option]", { hasText: "My Shapes" }).click();
  await page.getByRole("button", { name: "Choose an icon" }).click();
  const picker = page.getByRole("dialog", { name: "Choose an icon" });
  await picker.getByLabel("Search icons").fill("squ");
  await picker.getByRole("button", { name: "square, my-shapes" }).click();
  await picker.getByRole("button", { name: "Use icon" }).click();
  await expect(page.getByRole("dialog", { name: "Choose an icon" })).toHaveCount(0);

  // The sandboxed canvas draws it, decorative until it gets a name.
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  const drawn = canvas.locator("[data-nid][aria-hidden=true] svg");
  await expect(drawn).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Accessible name", { exact: true }).fill("Square");
  await expect(canvas.getByRole("img", { name: "Square" })).toBeVisible();

  // Switching to SVG code draws that instead, recolored and without scripts.
  await page.getByRole("button", { name: /Source$/ }).click();
  await page.locator("[role=option]", { hasText: "SVG code" }).click();
  await page
    .getByRole("textbox", { name: "SVG code" })
    .fill(
      '<svg viewBox="0 0 8 8"><script>alert(1)</script><path fill="#f00" d="M0 0h8v8z"/></svg>'
    );
  await expect(canvas.getByRole("img", { name: "Square" }).locator("path")).toHaveAttribute(
    "fill",
    "currentColor"
  );
  await page.getByRole("button", { name: /Source$/ }).click();
  await page.locator("[role=option]", { hasText: "Library icon" }).click();
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });

  // A library with icons in use cannot be removed.
  await openIcons();
  await page.getByRole("button", { name: "Remove My Shapes" }).click();
  await expect(page.getByText("in use, so it cannot be removed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeDisabled();
});
