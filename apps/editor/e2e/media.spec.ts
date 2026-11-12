import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// The Media library: upload, serve headers, SVG sanitizing, alt-text edit with its filter count,
// folders, move, trash and restore. Files are tiny and made here.

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const EVIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect onclick="x()" width="5" height="5"/></svg>';

async function openMedia(page: Page) {
  const email = `media-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Media Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Media project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await expect(page.getByText("No files yet")).toBeVisible();
}

const upload = (page: Page, name: string, mimeType: string, buffer: Buffer) =>
  page.getByTestId("media-file-input").setInputFiles({ name, mimeType, buffer });

test("upload, serve safely, add alt text, folder, trash and restore", async ({ page }) => {
  await openMedia(page);

  await upload(page, "Team Photo.png", "image/png", PNG);
  await expect(page.getByRole("button", { name: "Open Team Photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Missing alt text\s*1$/ })).toBeVisible();

  // Served from its stored path with the locked-down headers.
  await page.getByRole("button", { name: "Open Team Photo" }).click();
  const path = (await page.locator("dd", { hasText: /^\/media\// }).textContent()) ?? "";
  const res = await page.request.get(path);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["content-security-policy"]).toContain("sandbox");
  expect(res.headers()["access-control-allow-origin"]).toBe("*");
  const cached = await page.request.get(path, {
    headers: { "if-none-match": res.headers().etag ?? "" }
  });
  expect(cached.status()).toBe(304);

  // Alt text clears the "missing" count.
  await page.getByLabel("Alt text", { exact: true }).fill("Our team");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Missing alt text\s*0$/ })).toBeVisible();

  // A folder, then move the file into it.
  await page.getByRole("button", { name: "New folder" }).click();
  await page.getByLabel("Folder name").fill("Brand");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByRole("button", { name: /^Brand\s*0$/ })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("checkbox", { name: "Select Team Photo" }).check({ force: true });
  await page.getByRole("button", { name: "Move to", exact: true }).click();
  await page.getByRole("menuitem", { name: "Brand" }).click();
  await expect(page.getByRole("button", { name: /^Brand\s*1$/ })).toBeVisible();

  // Trash (unused, so no confirmation), then restore.
  await page.getByRole("button", { name: /^Brand/ }).click();
  await page.getByRole("checkbox", { name: "Select Team Photo" }).check({ force: true });
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page.getByText("No files yet").or(page.getByText("No files match"))).toBeVisible();
  await page.getByRole("button", { name: /^Trash\s*1$/ }).click();
  await page.getByRole("checkbox", { name: "Select Team Photo" }).check({ force: true });
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("The trash is empty")).toBeVisible();
  const after = await page.request.get(path);
  expect(after.status()).toBe(200);
});

test("SVG is sanitized, disguised HTML is refused and strangers cannot upload", async ({
  page,
  playwright,
  baseURL
}) => {
  await openMedia(page);

  await upload(page, "icon.svg", "image/svg+xml", Buffer.from(EVIL_SVG));
  await page.getByRole("button", { name: "Open icon" }).click();
  const path = (await page.locator("dd", { hasText: /^\/media\// }).textContent()) ?? "";
  const svg = await page.request.get(path);
  const body = await svg.text();
  expect(body).toContain("<rect");
  expect(body).not.toMatch(/script|onclick|alert/);
  expect(svg.headers()["content-security-policy"]).toContain("sandbox");
  await page.getByRole("button", { name: "Close details" }).click();

  await upload(page, "pic.png", "image/png", Buffer.from("<html><script>alert(1)</script></html>"));
  await expect(page.getByRole("alert").filter({ hasText: /HTML and script files/ })).toBeVisible();

  const projectId = page.url().split("/editor/")[1] ?? "";
  const stranger = await playwright.request.newContext({ baseURL: baseURL ?? "" });
  const denied = await stranger.post(`/api/projects/${projectId}/media`, {
    headers: { "x-file-name": "x.png" },
    data: PNG
  });
  expect(denied.status()).toBe(403);
  await stranger.dispose();
});

test("an Image element picks its file from Media and the library shows where it is used", async ({
  page
}) => {
  await openMedia(page);
  await upload(page, "Hero.png", "image/png", PNG);
  await page.getByRole("button", { name: "Open Hero" }).click();
  await page.getByLabel("Alt text", { exact: true }).fill("A hero image");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Missing alt text\s*0$/ })).toBeVisible();

  await page.getByRole("button", { name: "Navigator" }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await expect(page.getByRole("note").filter({ hasText: "Missing alt text" })).toBeVisible();
  await page.getByRole("button", { name: "Choose Source URL from Media" }).click();
  await page.getByRole("button", { name: "Choose Hero" }).click();
  await page.getByRole("button", { name: "Use file" }).click();
  await expect(page.getByPlaceholder("https://...")).toHaveValue(
    /^\/media\/[^/]+\/[a-f0-9]{24}\/hero\.png$/
  );
  await expect(page.getByRole("note").filter({ hasText: "Missing alt text" })).toHaveCount(0);
  // The file's alt text came along.
  await expect(page.getByLabel("Alt text", { exact: true })).toHaveValue("A hero image");
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();

  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page.getByRole("button", { name: "Open Hero" }).click();
  await expect(
    page.getByRole("complementary", { name: "File details" }).getByText("Home", { exact: true })
  ).toBeVisible();
  // Trashing a file in use asks first.
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page.getByRole("dialog")).toContainText("used on your site");
});

test("images are served resized, big uploads work and the cap holds", async ({ page }) => {
  await openMedia(page);
  const big = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "#336699" }
  })
    .png()
    .toBuffer();
  await upload(page, "wide.png", "image/png", big);
  await page.getByRole("button", { name: "Open wide" }).click();
  const path = (await page.locator("dd", { hasText: /^\/media\// }).textContent()) ?? "";

  const small = await page.request.get(`${path}?w=640`);
  expect(small.headers()["content-type"]).toBe("image/webp");
  const meta = await sharp(await small.body()).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(["webp", 640, 320]);
  const again = await page.request.get(`${path}?w=640`, {
    headers: { "if-none-match": small.headers().etag ?? "" }
  });
  expect(again.status()).toBe(304);

  // Not on the list, not smaller than the image, or no width asked: the original.
  for (const query of ["?w=641", "?w=2000", ""]) {
    const res = await page.request.get(`${path}${query}`);
    expect(res.headers()["content-type"]).toBe("image/png");
  }

  // The Image element's output carries the srcset.
  const projectId = page.url().split("/editor/")[1] ?? "";
  expect(projectId).not.toBe("");

  // A 45 MB video goes through the route; above the cap the route refuses.
  const video = Buffer.alloc(45 * 1024 * 1024);
  video.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const ok = await page.request.post(`/api/projects/${projectId}/media`, {
    headers: { "x-file-name": "clip.mp4" },
    data: video,
    timeout: 120_000
  });
  expect(ok.status()).toBe(200);
  const asset = ((await ok.json()) as { asset: { kind: string; size: number } }).asset;
  expect([asset.kind, asset.size]).toEqual(["video", video.length]);
  const tooBig = await page.request.post(`/api/projects/${projectId}/media`, {
    headers: { "x-file-name": "huge.mp4" },
    data: Buffer.alloc(201 * 1024 * 1024),
    timeout: 120_000
  });
  expect(tooBig.status()).toBe(413);
});
