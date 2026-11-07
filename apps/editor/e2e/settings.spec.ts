import { execFileSync } from "node:child_process";
import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Profile image, the account menu and the SMTP settings. The SMTP part runs a tiny SMTP server in
// this process; the app in Docker reaches it at host.docker.internal.

const SMTP_HOST = process.env.E2E_SMTP_HOST ?? "host.docker.internal";

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

/** Makes the user an owner, as the first user of an install is (e2e users sign up later). */
function promoteToOwner(email: string) {
  // Playwright runs from apps/editor.
  const root = path.resolve(process.cwd(), "../..");
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "sh",
      "-c",
      `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "update workspace_members set role='owner' where user_id = (select id from \\"user\\" where email = '${email.replace(/'/g, "")}')"`
    ],
    { cwd: root, stdio: "pipe" }
  );
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

interface Received {
  to: string[];
  data: string;
}

function startSmtp(received: Received[]): Promise<Server> {
  const server = createServer((socket: Socket) => {
    let mail: Received = { to: [], data: "" };
    let inData = false;
    let buffer = "";
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply("220 e2e ESMTP");
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let at: number;
      while ((at = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            received.push(mail);
            mail = { to: [], data: "" };
            reply("250 queued");
          } else mail.data += `${line}\n`;
          continue;
        }
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === "EHLO") reply("250-e2e\r\n250 AUTH PLAIN");
        else if (verb === "AUTH") reply("235 ok");
        else if (verb === "RCPT") {
          mail.to.push(line);
          reply("250 ok");
        } else if (verb === "DATA") {
          inData = true;
          reply("354 go");
        } else if (verb === "QUIT") {
          reply("221 bye");
          socket.end();
        } else reply("250 ok");
      }
    });
  });
  return new Promise((resolve) => server.listen(0, "0.0.0.0", () => resolve(server)));
}

test("SMTP accounts: add, test, send, templates, log and auth email", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const received: Received[] = [];
  const smtp = await startSmtp(received);
  const port = (smtp.address() as AddressInfo).port;
  const name = `E2E SMTP ${Date.now()}`;
  try {
    const email = await signUp(page, "Owner Tester");
    promoteToOwner(email);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Email", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add SMTP account" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await dialog.getByLabel("Host", { exact: true }).fill(SMTP_HOST);
    await dialog.getByLabel("Security", { exact: true }).click();
    await page.locator("[role=listbox] [role=option]", { hasText: "None" }).click();
    await dialog.getByLabel("Port", { exact: true }).fill(String(port));
    await dialog.getByLabel("Username", { exact: true }).fill("mailer");
    await dialog.getByLabel("Password", { exact: true }).fill("s3cret-pass");
    await dialog.getByLabel("From address", { exact: true }).fill("no-reply@example.com");
    await dialog.getByRole("button", { name: "Save account" }).click();
    await expect(dialog).toHaveCount(0);

    const row = page.getByRole("listitem").filter({ hasText: name });
    await row.getByRole("button", { name: "Test connection" }).click();
    await expect(row.getByRole("status")).toContainText("Connected to");

    await row.getByRole("button", { name: "Send test email" }).click();
    await page.getByRole("dialog").getByLabel("Send to").fill("inbox@example.com");
    await page.getByRole("dialog").getByRole("button", { name: "Send test" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Test email sent to inbox@example.com"
    );
    await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(received.at(-1)?.data).toContain("Subject: Nextomic test email");
    expect(received.at(-1)?.data).toContain("From: Nextomic <no-reply@example.com>");
    await expect(page.getByRole("table")).toContainText("inbox@example.com");

    // The saved password is never sent back to the browser.
    await row.getByRole("button", { name: `Edit ${name}` }).click();
    await expect(page.getByRole("dialog").getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(page.locator("body")).not.toContainText("s3cret-pass");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    // Edit the reset template, then make this account the default and request a reset.
    await page
      .getByRole("listitem")
      .filter({ hasText: "Reset password" })
      .getByRole("button", { name: "Edit" })
      .click();
    await page.getByRole("dialog").getByLabel("Subject").fill("E2E reset for {{name}}");
    await page.getByRole("dialog").getByRole("button", { name: "Save template" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await row.getByRole("button", { name: "Make default" }).click();
    await expect(row.getByText("Default", { exact: true })).toBeVisible();

    const visitor = await browser.newPage();
    await visitor.goto("/forgot-password");
    await visitor.getByLabel("Email").fill(email);
    await visitor.getByRole("button", { name: "Send reset link" }).click();
    await expect
      .poll(() => received.some((m) => m.data.includes("Subject: E2E reset for Owner Tester")), {
        timeout: 20_000
      })
      .toBe(true);
    expect(received.find((m) => m.data.includes("E2E reset"))?.data).toContain("reset-password");
    await visitor.close();

    // Put things back: default template, then remove the account.
    await page
      .getByRole("listitem")
      .filter({ hasText: "Reset password" })
      .getByRole("button", { name: "Edit" })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Reset to default" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await page.goto("/settings");
    page.once("dialog", (d) => void d.accept());
    const row = page.getByRole("listitem").filter({ hasText: name });
    if ((await row.count()) > 0) {
      await row.getByRole("button", { name: `Delete ${name}` }).click();
      await expect(row).toHaveCount(0);
    }
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
  }
});
