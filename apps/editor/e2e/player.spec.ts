import { expect, test, type Page } from "@playwright/test";

// Video and Audio (docs/elements.md "Video and Audio"): the tiles, the control switches, the
// Design parts, and a saved page whose bar plays, pauses, mutes, skips, changes speed and obeys keys.

async function signUpAndCreateProject(page: Page): Promise<string> {
  const email = `player-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Player Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery-staple-9");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await page
    .getByRole("button", { name: /New Project/i })
    .first()
    .click();
  await page.getByLabel("Name").fill("Player project");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/editor\/[^/]+$/);
  return page.url().split("/editor/")[1] ?? "";
}

const add = async (page: Page, tile: string) => {
  await page.getByRole("button", { name: "Add element" }).click();
  await page
    .getByRole("dialog", { name: "Elements" })
    .getByRole("button", { name: tile, exact: true })
    .click();
};

/** A silent mono WAV of the given length: small, and every browser plays it. */
function silence(seconds: number): Buffer {
  const rate = 8000;
  const size = rate * seconds;
  const out = Buffer.alloc(44 + size, 128);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + size, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate, 28);
  out.writeUInt16LE(1, 32);
  out.writeUInt16LE(8, 34);
  out.write("data", 36);
  out.writeUInt32LE(size, 40);
  return out;
}

const save = async (page: Page) => {
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 10_000
  });
};

test("video: tiles, bar on the canvas, control switches and the Video Player design parts", async ({
  page
}) => {
  await signUpAndCreateProject(page);
  await page.getByRole("button", { name: "Add element" }).click();
  const flyout = page.getByRole("dialog", { name: "Elements" });
  await expect(flyout.getByRole("button", { name: "Video", exact: true })).toBeVisible();
  await expect(flyout.getByRole("button", { name: "Audio", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await add(page, "Video");
  const canvas = page.frameLocator('iframe[title="Page canvas"]');
  await expect(canvas.locator("[data-nxt-bar]")).toBeVisible({ timeout: 15_000 });
  for (const part of ["play", "mute", "fullscreen", "big"])
    await expect(canvas.locator(`[data-nxt-btn="${part}"]`)).toBeVisible();
  await expect(canvas.locator("[data-nxt-seek]")).toBeVisible();

  // The Element tab: grouped settings, a switch per control, and the Media picker on the source.
  for (const heading of ["Source", "Playback", "Controls", "Behavior"])
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Source URL" })).toBeVisible();
  await page.getByRole("switch", { name: "Seek bar", exact: true }).click({ force: true });
  await expect(canvas.locator("[data-nxt-seek]")).toHaveCount(0);
  await page.getByRole("switch", { name: "Speed button", exact: true }).click({ force: true });
  await expect(canvas.locator('[data-nxt-btn="speed"]')).toBeVisible();

  // The Design tab lists every part of the player, each one its own folded row.
  await page.getByRole("tab", { name: /design/i }).click();
  const group = page.locator('[aria-label="Design settings"] > section').first();
  for (const part of [
    "Player",
    "Picture",
    "Big play button",
    "Control bar",
    "Seek bar",
    "Seek track",
    "Seek thumb",
    "Time",
    "Play button",
    "Mute button",
    "Volume slider",
    "Speed button",
    "Full screen button"
  ])
    await expect(group.getByRole("button", { name: part, exact: true })).toBeVisible();

  // An audio element has no picture, big button, Picture in Picture or full screen part.
  await page.getByRole("tab", { name: /element/i }).click();
  await add(page, "Audio");
  await expect(canvas.locator('[data-kind="audio"] [data-nxt-bar]')).toBeVisible();
  await expect(canvas.locator('[data-kind="audio"] [data-nxt-btn="fullscreen"]')).toHaveCount(0);
  await page.getByRole("tab", { name: /design/i }).click();
  const audio = page.locator('[aria-label="Design settings"] > section').first();
  await expect(audio.getByRole("button", { name: "Play button", exact: true })).toBeVisible();
  await expect(audio.getByRole("button", { name: "Full screen button", exact: true })).toHaveCount(
    0
  );
});

test("audio: a saved page plays, pauses, mutes, skips, changes speed and obeys keys", async ({
  page
}) => {
  const projectId = await signUpAndCreateProject(page);
  await add(page, "Audio");
  await page.getByRole("textbox", { name: "Source URL" }).fill("/e2e-clip.wav");
  for (const name of ["Skip forward button", "Speed button", "Loop button"])
    await page.getByRole("switch", { name, exact: true }).click({ force: true });
  await save(page);

  const preview = await page.context().newPage();
  // Seeking needs byte ranges, so the stub answers them like a real file server.
  const wav = silence(20);
  await preview.route("**/e2e-clip.wav", (route) => {
    const range = /bytes=(d+)-(d*)/.exec(route.request().headers()["range"] ?? "");
    if (!range) {
      return route.fulfill({
        status: 200,
        contentType: "audio/wav",
        headers: { "accept-ranges": "bytes" },
        body: wav
      });
    }
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
    return route.fulfill({
      status: 206,
      contentType: "audio/wav",
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${wav.length}`
      },
      body: wav.subarray(start, end + 1)
    });
  });
  await preview.goto(`/preview/${projectId}`);
  const player = preview.locator("[data-nxt-media]");
  await expect(player).toHaveAttribute("data-nxt-ready", "");
  await expect(player.locator("[data-nxt-duration]")).toHaveText("0:20", { timeout: 15_000 });
  // The browser's own bar is gone: ours is the one drawn.
  await expect(player.locator("audio")).not.toHaveAttribute("controls", /.*/);

  const current = player.locator("[data-nxt-current]");
  const play = player.locator('[data-nxt-btn="play"]');
  await expect(player).toHaveAttribute("data-state", "paused");
  await play.click();
  await expect(player).toHaveAttribute("data-state", "playing");
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await expect(current).not.toHaveText("0:00", { timeout: 8_000 });
  await play.click();
  await expect(player).toHaveAttribute("data-state", "paused");

  // Skip forward goes 10 seconds on; the keys work while the player has the focus.
  await player.locator('[data-nxt-btn="forward"]').click();
  await expect(current).toHaveText(/^0:1[0-2]$/);
  await player.focus();
  await preview.keyboard.press("5");
  await expect(current).toHaveText("0:10");
  await preview.keyboard.press("ArrowLeft");
  await expect(current).toHaveText("0:00");
  await preview.keyboard.press("m");
  await expect(player.locator('[data-nxt-btn="mute"]')).toHaveAttribute("aria-pressed", "true");
  await expect(player).toHaveAttribute("data-muted", "");
  await preview.keyboard.press("m");
  await expect(player).not.toHaveAttribute("data-muted", "");

  // Speed goes to the next one in the list; loop is a pressed button.
  const speed = player.locator('[data-nxt-btn="speed"]');
  await expect(speed).toHaveText("1x");
  await speed.click();
  await expect(speed).toHaveText("1.25x");
  const loop = player.locator('[data-nxt-btn="loop"]');
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await expect(player).toHaveAttribute("data-loop", "");

  // The seek bar is a real slider for the keyboard and screen readers.
  const seek = player.locator('[data-nxt-slider="seek"]');
  await seek.focus();
  await preview.keyboard.press("End");
  await expect(seek).toHaveValue("1000");
});
