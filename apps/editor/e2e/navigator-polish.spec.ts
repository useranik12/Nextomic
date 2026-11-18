import { expect, test, type Page } from "@playwright/test";

// Navigator and element panel polish: a click on a parent folds it, a double click renames, Unwrap
// moves an element out below its parent, matching classes show while adding one, and the
// breakpoint Kind select shows its whole label on one line.

async function newProject(page: Page) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Polish Tester");
  await page
    .getByLabel("Email")
    .fill(`polish-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Polish");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

const add = async (page: Page, tile: string) => {
  await page.getByRole("button", { name: "Add element" }).click();
  await page
    .getByRole("dialog", { name: "Elements" })
    .getByRole("button", { name: tile, exact: true })
    .click();
};

test("navigator: fold on click, rename on double click, unwrap", async ({ page }) => {
  await newProject(page);
  await add(page, "Container");
  await add(page, "Heading");
  const tree = page.getByRole("tree", { name: "Page elements" });
  const heading = tree.getByRole("treeitem", { name: /Heading/ });
  const container = tree.getByRole("treeitem", { name: /Container/ });
  await expect(heading).toBeVisible();

  // Clicking the parent's name folds it, and again unfolds it.
  await container.getByRole("button", { name: "Container", exact: true }).click();
  await expect(heading).toHaveCount(0);
  await container.getByRole("button", { name: "Container", exact: true }).click();
  await expect(heading).toBeVisible();

  // Double click opens the name field with the whole name selected.
  await heading.getByRole("button", { name: "Heading", exact: true }).dblclick();
  const name = tree.getByRole("textbox", { name: "Element name" });
  await expect(name).toBeFocused();
  await page.keyboard.type("Title");
  await page.keyboard.press("Enter");
  await expect(tree.getByRole("treeitem", { name: /Title/ })).toBeVisible();

  // Unwrap moves it out of the container, right below it.
  const title = tree.getByRole("treeitem", { name: /Title/ });
  await title.hover();
  await title.getByRole("button", { name: "Unwrap Title" }).click();
  await expect(tree.getByRole("treeitem", { name: /Title/ })).toHaveAttribute("aria-level", "1");
});

test("class field lists matching classes; breakpoint Kind fits its label", async ({ page }) => {
  await newProject(page);
  await add(page, "Heading");
  await page.getByLabel("Add a class").click();
  const field = page.getByRole("textbox", { name: "ID and classes" });
  await expect(field).toBeEditable();
  await field.fill("card");
  await page.keyboard.press("Enter");
  await add(page, "Heading");
  await page.getByLabel("Add a class").click();
  await expect(field).toBeEditable();
  await field.fill("car");
  const matches = page.getByRole("list", { name: "Matching classes" });
  await matches.getByRole("button", { name: ".card" }).click();
  await expect(page.getByText(".card").first()).toBeVisible();

  await page.getByRole("button", { name: "Manage breakpoints" }).click();
  const kind = page.getByRole("dialog").getByText("And below (max-width)").first();
  await expect(kind).toBeVisible();
  const box = await kind.boundingBox();
  expect(box?.height ?? 99).toBeLessThan(24);
});
