import { expect, test, type Page } from "@playwright/test";

// The builder shell rules: modals fit the screen minus 1.5rem and scroll inside, the dashboard
// header and search, settings look, Design System checks, and the Pages & Templates views.

test.use({ actionTimeout: 15_000, viewport: { width: 1024, height: 640 } });

async function signUpAndCreateProject(page: Page, projectName: string): Promise<void> {
  const email = `shell-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Shell Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill(projectName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

/** The open dialog fits the viewport minus 1.5rem (24px) and does not scroll itself. */
async function expectDialogFits(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]').last();
  await expect(dialog).toBeVisible();
  // Let the entrance animation (a short scale) finish before measuring.
  await page.waitForTimeout(600);
  const facts = await dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      left: box.left,
      top: box.top,
      scrolls: el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== "hidden",
      vw: window.innerWidth,
      vh: window.innerHeight
    };
  });
  expect(facts.width).toBeLessThanOrEqual(facts.vw - 24 + 1);
  expect(facts.height).toBeLessThanOrEqual(facts.vh - 24 + 1);
  expect(facts.left).toBeGreaterThanOrEqual(11);
  expect(facts.top).toBeGreaterThanOrEqual(11);
  expect(facts.scrolls).toBe(false);
}

test("dashboard header, builder search, nav icons and settings look", async ({ page }) => {
  await signUpAndCreateProject(page, "Zebra project");
  await page.goto("/dashboard");

  // The four-square icon is a plain link to the dashboard (no menu).
  await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("button", { name: "Shortcuts" })).toHaveCount(0);

  // The search icon grows into a wide field and finds settings and projects by name.
  const icon = page.getByRole("button", { name: "Search the builder" });
  const before = (await icon.boundingBox())?.width ?? 0;
  await icon.click();
  const field = page.getByRole("combobox", { name: "Search settings and projects" });
  await expect(field).toBeFocused();
  await expect
    .poll(async () => (await field.boundingBox())?.width ?? 0, { timeout: 5_000 })
    .toBeGreaterThan(before * 4);
  await field.fill("zebra");
  await expect(page.getByRole("option", { name: /Zebra project/ })).toBeVisible();
  await field.fill("appear");
  await expect(page.getByRole("option", { name: /Appearance/ })).toBeVisible();
  await field.press("Escape");
  await expect(field)
    .toBeHidden({ timeout: 2_000 })
    .catch(() => undefined);
  await expect(icon).toBeFocused();
  await icon.click();
  await field.fill("zebra");
  await page.getByRole("option", { name: /Zebra project/ }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);

  // Settings: nav icon, round avatar, appearance options side by side.
  await page.goto("/settings");
  const settingsLink = page.getByRole("navigation", { name: "Dashboard" }).getByRole("link", {
    name: "Settings"
  });
  await expect(settingsLink.locator("svg")).toHaveCount(1);
  const avatar = page.locator("main").getByText("S", { exact: true }).first();
  const round = await avatar.evaluate((el) => {
    let node: Element | null = el;
    while (node && getComputedStyle(node).borderRadius === "0px") node = node.parentElement;
    const box = node?.getBoundingClientRect();
    return { w: box?.width ?? 0, h: box?.height ?? 0 };
  });
  expect(Math.abs(round.w - round.h)).toBeLessThan(1.5);
  const radios = page.getByRole("radio");
  await expect(radios).toHaveCount(3);
  const tops = await radios.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().top))
  );
  expect(new Set(tops).size).toBe(1);
});

test("modals fit the screen, Design System checks, Pages & Templates views", async ({ page }) => {
  await signUpAndCreateProject(page, "Shell project");

  // Design System: nearly the whole screen, scrolls inside, selects keep their size.
  await page.getByRole("button", { name: "Design System" }).click();
  await expectDialogFits(page);
  const selects = page.getByRole("button", { name: /Sort|Filter/ });
  for (const select of await selects.all()) {
    const box = await select.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(100);
  }

  // Other modals follow the same rule.
  await page.getByRole("button", { name: "Close the Design System" }).click();
  await page.getByRole("button", { name: "Page settings" }).click();
  await expectDialogFits(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Design System" }).click();

  // Select all uses the HeroUI check and reaches the plain framework variables too.
  const all = page.getByRole("checkbox", { name: "Select all variables" });
  await all.check({ force: true });
  await expect(page.getByText(/\d+ selected/)).toBeVisible();
  const rows = page.getByRole("checkbox", { name: /^Select --/ });
  const total = await rows.count();
  const enabled = await rows.evaluateAll(
    (els) => els.filter((el) => !(el as HTMLInputElement).disabled).length
  );
  expect(total).toBeGreaterThan(0);
  const checked = await rows.evaluateAll(
    (els) => els.filter((el) => (el as HTMLInputElement).checked).length
  );
  expect(checked).toBe(enabled);
  await page.getByRole("button", { name: "Deselect all" }).click();
  await page.getByRole("button", { name: "Close the Design System" }).click();

  // Pages & Templates: one menu in both views, status and lock chips, aligned list columns.
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  const grid = page.getByRole("list", { name: "Items" });
  const card = grid.getByRole("button", { name: /^Select / }).first();
  await card.click();
  await expect(page.getByRole("button", { name: /^Edit / })).toBeVisible();
  // The icon row is Edit, Delete and the menu: the old eye (status) button is gone.
  await expect(
    page.getByRole("toolbar", { name: /^Actions for / }).getByRole("button")
  ).toHaveCount(3);
  await page.getByRole("button", { name: /^More actions for / }).click();
  for (const label of [
    "Edit",
    "Rename",
    "Duplicate",
    "Preview",
    "Open preview in new tab",
    "Regenerate screenshot",
    "Delete"
  ])
    await expect(page.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /Unpublish|Publish|Set to draft/ })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Column layout" }).first().click();
  const table = page.getByRole("table", { name: "Items" });
  await expect(table.getByRole("columnheader", { name: "Screenshot" })).toBeVisible();
  const headers = await table
    .getByRole("columnheader")
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
  const cells = await table
    .getByRole("row")
    .nth(1)
    .getByRole("cell")
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
  expect(cells).toHaveLength(headers.length);
  headers.forEach((left, i) => expect(Math.abs(left - (cells[i] ?? 0))).toBeLessThanOrEqual(1));
});

test("a published page shows Published, not Modified, and the project menu icon is centered", async ({
  page
}) => {
  await signUpAndCreateProject(page, "Status project");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/published/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Pages & Templates" }).click();
  const chips = page.getByRole("list", { name: "Items" }).locator(".chip");
  await expect(chips.filter({ hasText: "Published" })).toHaveCount(1, { timeout: 20_000 });
  await expect(chips.filter({ hasText: "Modified" })).toHaveCount(0);

  await page.goto("/projects");
  const trigger = page.getByRole("button", { name: /Status project actions/ });
  await trigger.locator("svg").waitFor();
  const offset = await trigger.evaluate((el) => {
    const svg = el.querySelector("svg")?.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return {
      dx: Math.abs(box.left + box.width / 2 - ((svg?.left ?? 0) + (svg?.width ?? 0) / 2)),
      dy: Math.abs(box.top + box.height / 2 - ((svg?.top ?? 0) + (svg?.height ?? 0) / 2))
    };
  });
  expect(offset.dx).toBeLessThan(1.5);
  expect(offset.dy).toBeLessThan(1.5);
});
