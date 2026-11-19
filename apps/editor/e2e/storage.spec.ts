import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { sql } from "drizzle-orm";
import { getDb } from "@nextomic/db";

// Files live in Supabase Storage under owner-first folders, and deleting the owning database row
// (as Studio or a script would) empties the folder. Needs the local database; skips without it.

function databaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(fileURLToPath(new URL("../../../.env", import.meta.url)), "utf8");
    return /^DATABASE_URL=(.+)$/m.exec(env)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

const url = databaseUrl();
test.skip(!url, "needs DATABASE_URL");
test.describe.configure({ timeout: 90_000 });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function objectNames(bucket: string, prefix: string): Promise<string[]> {
  process.env.DATABASE_URL = url ?? "";
  const result = await getDb().execute<{ name: string }>(
    sql`select name from storage.objects where bucket_id = ${bucket} and name like ${prefix + "%"} order by name`
  );
  return result.rows.map((row) => row.name);
}

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Storage Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("project media lands under workspace/project folders and goes when the project row is deleted", async ({
  page
}) => {
  await signUp(page, `storage-${Date.now()}@example.com`);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Storage project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
  const projectId = page.url().split("/").pop() ?? "";
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page
    .getByTestId("media-file-input")
    .setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Open dot" })).toBeVisible();

  process.env.DATABASE_URL = url ?? "";
  const workspace = await getDb().execute<{ workspace_id: string }>(
    sql`select workspace_id from nextomic_builder.projects where id = ${projectId}`
  );
  const prefix = `${workspace.rows[0]?.workspace_id}/${projectId}/`;
  const names = await objectNames("app-uploads", prefix);
  expect(names).toHaveLength(1);
  expect(names[0]).toBe(`${prefix}media-assets/image/dot.png`);

  await getDb().execute(sql`delete from nextomic_builder.projects where id = ${projectId}`);
  await expect.poll(() => objectNames("app-uploads", prefix), { timeout: 60_000 }).toEqual([]);
});

test("uploads keep their own name, a repeated name gets a number and an odd name uses the asset id", async ({
  page
}) => {
  await signUp(page, `storage-names-${Date.now()}@example.com`);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Names project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/[/]editor[/][^/]+$/);
  const projectId = page.url().split("/").pop() ?? "";
  await page.getByRole("button", { name: "Media", exact: true }).click();
  const input = page.getByTestId("media-file-input");
  await input.setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Open dot", exact: true })).toBeVisible();
  await input.setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Open dot", exact: true })).toHaveCount(2);
  await input.setInputFiles({ name: "日本語.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: /^Open 日本語/ })).toBeVisible();

  process.env.DATABASE_URL = url ?? "";
  const workspace = await getDb().execute<{ workspace_id: string }>(
    sql`select workspace_id from nextomic_builder.projects where id = ${projectId}`
  );
  const prefix = `${workspace.rows[0]?.workspace_id}/${projectId}/media-assets/image/`;
  const names = (await objectNames("app-uploads", prefix)).map((n) => n.slice(prefix.length));
  expect(names.filter((n) => /^dot[.](png|webp)$/.test(n))).toHaveLength(1);
  expect(names.filter((n) => /^dot-2[.](png|webp)$/.test(n))).toHaveLength(1);
  expect(names.filter((n) => /^[0-9a-f-]{36}[.](png|webp)$/.test(n))).toHaveLength(1);

  // The library row holds no copy of what storage knows: name, type, size and ETag come from the view.
  const view = await getDb().execute<{
    file_name: string;
    mime: string;
    size: number;
    hash: string;
  }>(
    sql`select file_name, mime, size, hash from nextomic_builder.media_library where project_id = ${projectId} and file_name like 'dot.%'`
  );
  expect(view.rows[0]?.mime).toMatch(/^image[/](png|webp)$/);
  expect(view.rows[0]?.size).toBeGreaterThan(0);
  expect(view.rows[0]?.hash).toMatch(/^[0-9a-f]{32}$/);
  const cols = await getDb().execute<{ column_name: string }>(
    sql`select column_name from information_schema.columns where table_schema = 'nextomic_builder' and table_name = 'media_assets'`
  );
  const have = cols.rows.map((c) => c.column_name);
  for (const dropped of ["mime", "size", "hash", "file_name", "original_name", "kind"])
    expect(have).not.toContain(dropped);
});

test("a profile image lands under the user's uuid and goes when the account is deleted", async ({
  page
}) => {
  const email = `storage-user-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.goto("/settings");
  // Under load the file can be set before the page hydrates; pick it again until Save shows.
  await expect(async () => {
    await page
      .getByLabel("Profile image file")
      .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible({
      timeout: 1_000
    });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  process.env.DATABASE_URL = url ?? "";
  const user = await getDb().execute<{ user_uid: string }>(
    sql`select user_uid from public.users where email = ${email}`
  );
  const uid = user.rows[0]?.user_uid ?? "";
  const prefix = `${uid}/`;
  const names = await objectNames("customer-data", prefix);
  expect(names).toHaveLength(1);
  expect(names[0]).toMatch(new RegExp(`^${uid}/user-image/[0-9a-f]{24}[.]webp$`));

  const db = getDb();
  await db.execute(sql`delete from nextomic_builder.projects where created_by = ${uid}`);
  await db.execute(sql`delete from auth.users where id = ${uid}`);
  await expect.poll(() => objectNames("customer-data", prefix), { timeout: 60_000 }).toEqual([]);
});

test("deleting a workspace empties every project folder inside it", async ({ page }) => {
  await signUp(page, `storage-ws-${Date.now()}@example.com`);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Workspace project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
  const projectId = page.url().split("/").pop() ?? "";
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page
    .getByTestId("media-file-input")
    .setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Open dot" })).toBeVisible();

  process.env.DATABASE_URL = url ?? "";
  const row = await getDb().execute<{ workspace_id: string }>(
    sql`select workspace_id from nextomic_builder.projects where id = ${projectId}`
  );
  const workspaceId = row.rows[0]?.workspace_id ?? "";
  expect(await objectNames("app-uploads", `${workspaceId}/`)).toHaveLength(1);

  await getDb().execute(sql`delete from nextomic_builder.workspaces where id = ${workspaceId}`);
  await expect
    .poll(() => objectNames("app-uploads", `${workspaceId}/`), { timeout: 60_000 })
    .toEqual([]);
});
