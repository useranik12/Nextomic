import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Builder sign-in flows that send mail: password reset, magic link and the code that confirms a
// password change. Mail from the local Supabase lands in Mailpit (http://localhost:8025).

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = "correct-horse-battery-staple-9";

async function mailTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = (await (
      await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    ).json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
        Text: string;
        HTML: string;
      };
      return `${message.Text}\n${message.HTML}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No mail arrived for ${email}`);
}

const linkIn = (body: string): string => {
  const match = /https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/.exec(body);
  if (!match) throw new Error("No link in the mail");
  return match[0].replaceAll("&amp;", "&");
};

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Mail Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a forgotten password is reset through the emailed link", async ({ page }) => {
  const email = `reset-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.context().clearCookies();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /send|reset/i }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(linkIn(await mailTo(email)));
  await expect(page).toHaveURL(/\/reset-password/);
  const next = "another-long-passphrase-42";
  await page.getByLabel("New password").fill(next);
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("a magic link signs an existing account in", async ({ page }) => {
  const email = `magic-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.context().clearCookies();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText(/sign-in link is on its way/i)).toBeVisible();

  await page.goto(linkIn(await mailTo(email)));
  await expect(page).toHaveURL(/\/dashboard/);
});

test("a password change needs the code emailed to the account", async ({ page }) => {
  const email = `change-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Send code" }).click();

  const code = /\b(\d{6})\b/.exec(await mailTo(email))?.[1];
  expect(code).toBeTruthy();
  await page.getByLabel("Code from the email").fill(code ?? "");
  const next = "a-brand-new-passphrase-77";
  await page.getByLabel(/new password/i).fill(next);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();
});

// ---- Two-factor sign-in and passkeys -------------------------------------------------------------

function totp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)?.map((b) => parseInt(b, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

test("two-factor: turn on, then sign-in asks for the authenticator code", async ({ page }) => {
  const email = `totp-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Turn on" }).click();
  const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
  expect(secret.length).toBeGreaterThan(10);
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/two-factor/);
  // The password step alone reaches nothing behind the sign-in.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in|\/two-factor/);
  await page.goto("/two-factor");
  await page.getByLabel("Authenticator code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("passkeys: add one in settings, then sign in with it", async ({ page, context }) => {
  const client = await context.newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });
  const email = `passkey-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByText(/Added /)).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Use a passkey" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
